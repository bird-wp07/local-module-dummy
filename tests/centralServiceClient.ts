import { AxiosRequestConfig } from "axios";
import { ok, err, Result } from "neverthrow"
import { Base64 } from "../src/types/common";
import * as Utility from "../src/utility"

export class centralServiceClient {
    public async getSignedCMS(request: ISignatureRequest): Promise<Result<ISignatureResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/api/v1/signer/issuances",
            baseURL: "https://46.83.201.35.bc.googleusercontent.com",
            data: request
        }
        const response = await Utility.httpReq(config)
        if (response.isErr()) {
            return err(response.error)
        }
        return ok(response.value.data)
    }
}

export interface ISignatureRequest {
    issuerId: String,
    hash: Base64,
    digestMethod: String,
    auditLog: String
}

export interface ISignatureResponse {
        signatureHash: String,
        signature: String,
        cms: String
}