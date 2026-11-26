// A tiny HTTP/1.1 server bound to 127.0.0.1 only. Steam's pages load theme files and the in-Steam script from it.
#pragma once
#include <functional>
#include <string>

struct HttpRequest {
	std::string method, path, query, origin, body;
};

struct HttpResponse {
	int code = 200;
	std::string mime = "text/plain", body;
};

class HttpServer {
public:
	// Tries ports first..first+9; returns the port it listens on, or 0.
	int Start(int first, std::function<HttpResponse(const HttpRequest&)> handler);

private:
	void Serve(unsigned long long sock);
	std::function<HttpResponse(const HttpRequest&)> handler_;
};
