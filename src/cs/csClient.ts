import { AxiosRequestConfig } from "axios"
import { ok, err, Result } from "neverthrow"
import { IFetchSignatureResponse, IFetchSignatureRequest, Schema_IFetchAuthToken, IFetchAuthTokenResponse } from "./types"
import * as Utility from "../utility"
import * as https from "https"
import * as fs from "fs"

export abstract class ICsClient {
    public abstract isOnline(): Promise<boolean>
    public abstract fetchSignature(request: IFetchSignatureRequest): Promise<Result<IFetchSignatureResponse, Error>>
}

export class CsClient implements ICsClient {
    baseurl: string
    issuerId: string
    tokenUrl: string
    authHttpsAgent: https.Agent
    constructor(baseurl: string, issuerId: string, tokenUrl: string, mtlsClientPfxFile: string, mtslClientPfxFilePassword: string, mtlsCaPemfile: string) {
        this.baseurl = baseurl
        this.issuerId = issuerId
        this.tokenUrl = tokenUrl
        this.authHttpsAgent = new https.Agent({
            ca: fs.readFileSync(mtlsCaPemfile),
            pfx: fs.readFileSync(mtlsClientPfxFile),
            passphrase: mtslClientPfxFilePassword
        })
    }

    /**
     * Factory for exception-less construction of CsClients.
     */
    static make(baseurl: string, issuerId: string, tokenUrl: string, mtlsClientPfxFile: string, mtslClientPfxFilePassword: string, mtlsCaPemfile: string): Result<CsClient, Error> {
        try {
            return ok(new CsClient(baseurl, issuerId, tokenUrl, mtlsClientPfxFile, mtslClientPfxFilePassword, mtlsCaPemfile))
        } catch (error: unknown) {
            if (error instanceof Error) {
                return err(error)
            }
            return err(new Error(JSON.stringify(error)))
        }
    }

    /**
     * Returns true iff the CS reponds to requests.
     */
    async isOnline(): Promise<boolean> {
        // COMBAK: Eventually use the central service's /health endpoint.
        const config: AxiosRequestConfig = {
            method: "GET",
            url: "/swagger-ui/index.html",
            baseURL: this.baseurl
        }
        const response = await Utility.httpReq(config)
        if (response.isErr()) {
            return false
        }
        return true
    }

    /**
     * Returns a CAdES-conforming CMS object.
     *
     * See EN 319 122-1.
     */
    async fetchSignature(request: IFetchSignatureRequest): Promise<Result<IFetchSignatureResponse, Error>> {
        const fetchAuthTokenResult = await this.fetchAuthToken()
        if (fetchAuthTokenResult.isErr()) {
            return err(fetchAuthTokenResult.error)
        }
        const tokenContainer = fetchAuthTokenResult.value

        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/api/auth/v1/signer/issuances",
            baseURL: this.baseurl,
            headers: { Authorization: `Bearer ${tokenContainer.access_token}` },
            data: { ...request, issuerId: this.issuerId }
        }
        const response = await Utility.httpReq(config)
        if (response.isErr()) {
            return err(response.error)
        }
        return ok(response.value.data)
    }

    /**
     * Returns container object containing the authentication token.
     */
    async fetchAuthToken(): Promise<Result<IFetchAuthTokenResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: this.tokenUrl,
            data: {
                client_id: "bird-issuance-service",
                grant_type: "password",
                scope: "issueing"
            },
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            httpsAgent: this.authHttpsAgent
        }
        const response = await Utility.httpReq(config)
        if (response.isErr()) {
            return err(response.error)
        }

        /* Validate response */
        const validationResponse = Schema_IFetchAuthToken.validate(response.value.data)
        if (validationResponse.error !== undefined) {
            return err(validationResponse.error)
        }

        return ok(response.value.data)
    }
}
