#include <winsock2.h>
#include <ws2tcpip.h>
#include <thread>
#include "http.h"

int HttpServer::Start(int first, std::function<HttpResponse(const HttpRequest&)> handler) {
	handler_ = std::move(handler);
	WSADATA wsa;
	WSAStartup(MAKEWORD(2, 2), &wsa);
	for (int port = first; port < first + 10; port++) {
		SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
		if (s == INVALID_SOCKET) return 0;
		BOOL excl = TRUE;
		setsockopt(s, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, (const char*)&excl, sizeof excl);
		sockaddr_in a{};
		a.sin_family = AF_INET;
		a.sin_port = htons((u_short)port);
		inet_pton(AF_INET, "127.0.0.1", &a.sin_addr);
		if (bind(s, (sockaddr*)&a, sizeof a) == 0 && listen(s, 64) == 0) {
			std::thread([this, s] {
				for (;;) {
					SOCKET c = accept(s, nullptr, nullptr);
					if (c == INVALID_SOCKET) continue;
					std::thread([this, c] { Serve(c); }).detach();
				}
			}).detach();
			return port;
		}
		closesocket(s);
	}
	return 0;
}

static std::string Header(const std::string& head, const char* name) {
	std::string lower = head;
	for (auto& ch : lower) ch = (char)tolower((unsigned char)ch);
	std::string key = std::string("\r\n") + name + ":";
	size_t at = lower.find(key);
	if (at == std::string::npos) return "";
	size_t start = at + key.size(), end = head.find("\r\n", start);
	std::string v = head.substr(start, end - start);
	while (!v.empty() && v.front() == ' ') v.erase(v.begin());
	return v;
}

void HttpServer::Serve(unsigned long long sockv) {
	SOCKET c = (SOCKET)sockv;
	DWORD timeout = 5000;
	setsockopt(c, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeout, sizeof timeout);
	std::string data;
	char buf[8192];
	size_t headEnd;
	while ((headEnd = data.find("\r\n\r\n")) == std::string::npos) {
		int n = recv(c, buf, sizeof buf, 0);
		if (n <= 0 || data.size() > (1 << 16)) { closesocket(c); return; }
		data.append(buf, n);
	}
	std::string head = data.substr(0, headEnd);
	size_t len = strtoul(Header(head, "content-length").c_str(), nullptr, 10);
	if (len > (8 << 20)) { closesocket(c); return; }
	std::string body = data.substr(headEnd + 4);
	while (body.size() < len) {
		int n = recv(c, buf, sizeof buf, 0);
		if (n <= 0) break;
		body.append(buf, n);
	}

	HttpRequest req;
	size_t sp1 = head.find(' '), sp2 = head.find(' ', sp1 + 1);
	req.method = head.substr(0, sp1);
	std::string target = head.substr(sp1 + 1, sp2 - sp1 - 1);
	size_t q = target.find('?');
	req.path = target.substr(0, q);
	if (q != std::string::npos) req.query = target.substr(q + 1);
	req.origin = Header(head, "origin");
	req.body = body.substr(0, len);

	HttpResponse res;
	if (req.method == "OPTIONS") res.code = 204;
	else res = handler_(req);

	const char* phrase = res.code == 200 ? "OK" : res.code == 204 ? "No Content" : res.code == 403 ? "Forbidden" : "Not Found";
	std::string out = "HTTP/1.1 " + std::to_string(res.code) + " " + phrase + "\r\nContent-Type: " + res.mime +
		"\r\nContent-Length: " + std::to_string(res.body.size()) +
		"\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\nAccess-Control-Allow-Private-Network: true"
		"\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n" + res.body;
	for (size_t sent = 0; sent < out.size();) {
		int n = send(c, out.data() + sent, (int)std::min<size_t>(out.size() - sent, 1 << 20), 0);
		if (n <= 0) break;
		sent += n;
	}
	shutdown(c, SD_SEND);
	closesocket(c);
}
