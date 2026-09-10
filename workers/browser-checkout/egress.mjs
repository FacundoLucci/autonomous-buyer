import http from "node:http";
import net from "node:net";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
export function publicAddress(address) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === "ipv6" && ip.isIPv4MappedAddress()) ip = ip.toIPv4Address();
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
// Resolve once and connect to the validated IP: DNS changes cannot redirect a
// browser request into cloud metadata or a private service.
export async function startEgressProxy() {
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    res.writeHead(403);
    res.end();
  });
  server.on("connect", async (req, client, head) => {
    try {
      const destination = new URL(`https://${req.url}`);
      if (destination.port && destination.port !== "443") throw Error("HTTPS only");
      const hostname = destination.hostname.replace(/^\[|\]$/g, "");
      const answers = await lookup(hostname, { all: true });
      if (!answers.length || answers.some((a) => !publicAddress(a.address)))
        throw Error("Private destination");
      const upstream = net.connect({
        host: answers[0].address,
        port: 443,
        family: answers[0].family,
      });
      sockets.add(upstream);
      upstream.setTimeout(60000, () => upstream.destroy());
      upstream.on("close", () => sockets.delete(upstream));
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
      client.on("close", () => upstream.destroy());
      upstream.on("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        client.pipe(upstream);
        upstream.pipe(client);
      });
    } catch {
      client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close() {
      for (const socket of sockets) socket.destroy();
      server.close();
    },
  };
}
