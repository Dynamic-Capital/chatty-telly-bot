import StorageFileApi from './packages/StorageFileApi.d.ts';
import StorageBucketApi from './packages/StorageBucketApi.d.ts';
import { Fetch } from './lib/fetch.d.ts';
export interface StorageClientOptions {
    useNewHostname?: boolean;
}
export declare class StorageClient extends StorageBucketApi {
    constructor(url: string, headers?: {
        [key: string]: string;
    }, fetch?: Fetch, opts?: StorageClientOptions);
    /**
     * Perform file operation in a bucket.
     *
     * @param id The bucket id to operate on.
     */
    from(id: string): StorageFileApi;
}
//# sourceMappingURL=StorageClient.d.ts.map
