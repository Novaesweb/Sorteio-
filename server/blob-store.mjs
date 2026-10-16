class InitialWriteConflict extends Error {}
// SDK injected to keep storage contract tests independent of accounts and network.
export function createBlobStore(sdk, pathname) {
  return {
    async read() {
      const result = await sdk.get(pathname, { access:'private', useCache:false });
      if (!result) return null;
      if (result.statusCode !== 200 || !result.stream || !result.blob.etag) throw new Error('InvalidBlobResponse');
      return { bytes:Buffer.from(await new Response(result.stream).arrayBuffer()), etag:result.blob.etag };
    },
    async write(bytes, etag) {
      try { await sdk.put(pathname, bytes, {
        access:'private', addRandomSuffix:false,
        // First creation must fail if another invocation created the state meanwhile.
        allowOverwrite:etag !== null, ...(etag !== null ? { ifMatch:etag } : {}),
        contentType:'application/vnd.sqlite3'
      }); } catch(error) {
        // SDK reports an existing pathname as a generic BlobError on first creation.
        // Confirm existence before treating it as a concurrent writer.
        if(etag===null) {
          const current=await sdk.get(pathname,{access:'private',useCache:false});
          if(current?.statusCode===200) { await current.stream?.cancel(); throw new InitialWriteConflict(); }
        }
        throw error;
      }
    },
    isConflict(error) {
      return error instanceof InitialWriteConflict || Boolean(sdk.BlobPreconditionFailedError && error instanceof sdk.BlobPreconditionFailedError);
    }
  };
}
