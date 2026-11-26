#include "ws.h"

std::wstring Widen(const std::string& s) {
	if (s.empty()) return {};
	int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
	std::wstring w(n, L'\0');
	MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), w.data(), n);
	return w;
}

std::string Narrow(const std::wstring& w) {
	if (w.empty()) return {};
	int n = WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), nullptr, 0, nullptr, nullptr);
	std::string s(n, '\0');
	WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), s.data(), n, nullptr, nullptr);
	return s;
}

bool HttpGet(int port, const std::wstring& path, std::string& body) {
	body.clear();
	HINTERNET s = WinHttpOpen(L"BeyondSteam", WINHTTP_ACCESS_TYPE_NO_PROXY, nullptr, nullptr, 0);
	if (!s) return false;
	WinHttpSetTimeouts(s, 1000, 1000, 2000, 3000);
	bool ok = false;
	if (HINTERNET c = WinHttpConnect(s, L"127.0.0.1", (INTERNET_PORT)port, 0)) {
		if (HINTERNET r = WinHttpOpenRequest(c, L"GET", path.c_str(), nullptr, nullptr, nullptr, 0)) {
			if (WinHttpSendRequest(r, WINHTTP_NO_ADDITIONAL_HEADERS, 0, nullptr, 0, 0, 0) && WinHttpReceiveResponse(r, nullptr)) {
				DWORD status = 0, len = sizeof status;
				WinHttpQueryHeaders(r, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, nullptr, &status, &len, nullptr);
				char buf[16384];
				DWORD n = 0;
				while (WinHttpReadData(r, buf, sizeof buf, &n) && n) body.append(buf, n);
				ok = status == 200;
			}
			WinHttpCloseHandle(r);
		}
		WinHttpCloseHandle(c);
	}
	WinHttpCloseHandle(s);
	return ok;
}

bool WebSocket::Connect(int port, const std::wstring& path) {
	Close();
	session_ = WinHttpOpen(L"BeyondSteam", WINHTTP_ACCESS_TYPE_NO_PROXY, nullptr, nullptr, 0);
	if (!session_) return false;
	WinHttpSetTimeouts(session_, 2000, 2000, 10000, 0);
	conn_ = WinHttpConnect(session_, L"127.0.0.1", (INTERNET_PORT)port, 0);
	if (!conn_) return false;
	HINTERNET req = WinHttpOpenRequest(conn_, L"GET", path.c_str(), nullptr, nullptr, nullptr, 0);
	if (!req) return false;
	bool ok = WinHttpSetOption(req, WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET, nullptr, 0) &&
		WinHttpSendRequest(req, WINHTTP_NO_ADDITIONAL_HEADERS, 0, nullptr, 0, 0, 0) &&
		WinHttpReceiveResponse(req, nullptr);
	if (ok) ws_ = WinHttpWebSocketCompleteUpgrade(req, 0);
	WinHttpCloseHandle(req);
	return ws_ != nullptr;
}

bool WebSocket::Send(const std::string& text) {
	std::lock_guard<std::mutex> lock(sendMu_);
	HINTERNET h = ws_;
	if (!h) return false;
	return WinHttpWebSocketSend(h, WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE, (PVOID)text.data(), (DWORD)text.size()) == NO_ERROR;
}

bool WebSocket::Receive(std::string& out) {
	out.clear();
	static thread_local char buf[1 << 16];
	for (;;) {
		HINTERNET h = ws_;
		if (!h) return false;
		DWORD n = 0;
		WINHTTP_WEB_SOCKET_BUFFER_TYPE type;
		if (WinHttpWebSocketReceive(h, buf, sizeof buf, &n, &type) != NO_ERROR) return false;
		if (type == WINHTTP_WEB_SOCKET_CLOSE_BUFFER_TYPE) return false;
		out.append(buf, n);
		if (type == WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE || type == WINHTTP_WEB_SOCKET_BINARY_MESSAGE_BUFFER_TYPE) return true;
	}
}

void WebSocket::Close() {
	if (HINTERNET h = ws_.exchange(nullptr)) WinHttpCloseHandle(h);
	if (conn_) { WinHttpCloseHandle(conn_); conn_ = nullptr; }
	if (session_) { WinHttpCloseHandle(session_); session_ = nullptr; }
}
