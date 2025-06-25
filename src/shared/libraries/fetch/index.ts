import Object from "@rbxts/object-utils";
import { HttpService } from "@rbxts/services";
export interface RobloxResponse {
	readonly ok: boolean;
	readonly status: number;
	readonly statusText: string;
	readonly headers: Map<string, string>;
	readonly url: string;

	text(): Promise<string>;
	json(): Promise<unknown>;
	arrayBuffer(): Promise<Array<number>>;
}
interface FetchOptions {
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
	headers?: { [key: string]: string };
	body?: string;
	timeout?: number;
}

export async function fetch(url: string, options: FetchOptions = {}): Promise<RobloxResponse> {
	const requestOptions: FetchOptions = {
		method: "GET",
		headers: {},
		...options
	};

	const headers = requestOptions.headers ?? {};
	headers["Content-Type"] = headers["Content-Type"] ?? "application/json";

	try {
		const response = HttpService.RequestAsync({
			Url: url,
			Method: requestOptions.method,
			Headers: headers,
			Body: requestOptions.body,
		});

		const robloxResponse: RobloxResponse = {
			ok: response.Success,
			status: response.Success ? 200 : response.StatusCode,
			statusText: response.Success ? "OK" : "Error",
			headers: new Map(Object.entries(response.Headers ?? {})),
			url: url,

			async text() {
				return response.Body;
			},

			async json() {
				try {
					return HttpService.JSONDecode(response.Body);
				} catch (err) {
					throw "Failed to parse JSON";
				}
			},

			async arrayBuffer() {
				const body = response.Body;
				const bytes: Array<number> = [];

				for (let i = 0; i < body.size(); i++) {
					bytes.push(string.byte(body, i + 1)[0]);
				}

				return bytes;
			}
		};

		return robloxResponse;
	} catch (err) {
		const errorResponse: RobloxResponse = {
			ok: false,
			status: 0,
			statusText: tostring(err),
			headers: new Map(),
			url: url,

			async text() {
				return tostring(err);
			},

			async json() {
				throw tostring(err);
			},

			async arrayBuffer() {
				throw tostring(err);
			}
		};

		return errorResponse;
	}
}