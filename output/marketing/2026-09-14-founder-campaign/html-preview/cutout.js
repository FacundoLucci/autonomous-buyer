// Reuses the approved product campaign HTML renderer for the supplies photo only.
    const cutoutCache = new Map();
    function cutout(source) {
      if (cutoutCache.has(source)) return cutoutCache.get(source);
      const result = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const data = pixels.data;
          const w = canvas.width, h = canvas.height, size = w * h;
          const foreground = new Uint8Array(size);
          for (let p = 0; p < size; p++) {
            const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
            const chroma = Math.max(r, g, b) - Math.min(r, g, b);
            foreground[p] = chroma > 16 || (r + g + b) / 3 > 205 ? 1 : 0;
          }
          const labels = new Int32Array(size);
          const queue = new Int32Array(size);
          let label = 0, largestLabel = 0, largestSize = 0;
          for (let p = 0; p < size; p++) {
            if (!foreground[p] || labels[p]) continue;
            label++;
            let head = 0, tail = 1;
            queue[0] = p;
            labels[p] = label;
            while (head < tail) {
              const q = queue[head++], x = q % w;
              for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q >= w ? q - w : -1, q < size - w ? q + w : -1]) {
                if (n >= 0 && foreground[n] && !labels[n]) { labels[n] = label; queue[tail++] = n; }
              }
            }
            if (tail > largestSize) { largestSize = tail; largestLabel = label; }
          }
          // Flood only the outside; keep dark folds and shadows inside the silhouette.
          const outside = new Uint8Array(size);
          let head = 0, tail = 0;
          const enqueue = p => { if (labels[p] !== largestLabel && !outside[p]) { outside[p] = 1; queue[tail++] = p; } };
          for (let x = 0; x < w; x++) { enqueue(x); enqueue(size - w + x); }
          for (let y = 0; y < h; y++) { enqueue(y * w); enqueue(y * w + w - 1); }
          while (head < tail) {
            const q = queue[head++], x = q % w;
            if (x > 0) enqueue(q - 1);
            if (x < w - 1) enqueue(q + 1);
            if (q >= w) enqueue(q - w);
            if (q < size - w) enqueue(q + w);
          }
          // A paper cup is horizontally convex. Preserve the shaded paper between
          // its two edges, even where its color resembles the neutral backdrop.
          const cupRange = source.endsWith('/supplies.png') ? [50, 490] : [0, w - 1];
          for (let y = 0; y < h; y++) {
            let first = -1, last = -1;
            for (let x = cupRange[0]; x <= cupRange[1]; x++) {
              if (labels[y * w + x] === largestLabel) { if (first < 0) first = x; last = x; }
            }
            if (first >= 0) for (let x = first; x <= last; x++) outside[y * w + x] = 0;
          }
          for (let p = 0; p < size; p++) data[p * 4 + 3] = outside[p] ? 0 : 255;
          context.putImageData(pixels, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = reject;
        image.src = source;
      });
      cutoutCache.set(source, result);
      return result;
    }
    window.cutoutsReady = Promise.all([...document.querySelectorAll('.supplies')].map(async image => {
      image.style.visibility = 'hidden';
      image.src = await cutout(image.src);
      await image.decode();
      image.style.visibility = 'visible';
    }));
