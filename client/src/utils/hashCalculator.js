import SparkMD5 from 'spark-md5';

/**
 * Creates an incremental MD5 hasher instance that processes chunks sequentially
 * Works seamlessly in non-HTTPS local IP contexts without requiring crypto.subtle.
 */
export function createIncrementalHasher() {
  const spark = new SparkMD5.ArrayBuffer();
  let bytesHashed = 0;

  return {
    append(arrayBuffer) {
      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        spark.append(arrayBuffer);
        bytesHashed += arrayBuffer.byteLength;
      }
    },
    finalize() {
      return spark.end(); // Returns 32-character hex string
    },
    reset() {
      spark.reset();
      bytesHashed = 0;
    },
    getBytesHashed() {
      return bytesHashed;
    }
  };
}
