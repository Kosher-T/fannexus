import { Blob } from 'buffer';

// Polyfill for Node 18 compatibility with undici v6/v7 (ReferenceError: File is not defined)
if (typeof (global as any).File === 'undefined') {
  (global as any).File = class extends Blob {
    name: string;
    lastModified: number;
    constructor(chunks: any[], name: string, options?: any) {
      super(chunks, options);
      this.name = name;
      this.lastModified = options?.lastModified || Date.now();
    }
  };
}
