// Deterministic fake embedding so integration tests never load the real
// (ESM-only, multi-MB) @xenova/transformers model. Jest's CJS runtime can't
// import it directly, and we don't want tests downloading a model anyway.
function pipeline() {
  return Promise.resolve(async (text) => {
    const dims = 384;
    const data = new Float32Array(dims);
    for (let i = 0; i < dims; i++) {
      const code = text.charCodeAt(i % text.length) || 0;
      data[i] = Math.sin(code + i) * 0.01;
    }
    return { data };
  });
}

module.exports = { pipeline };
