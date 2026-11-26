// Minimal WebSocket and HTTP client on WinHTTP (built into Windows), used to talk to Steam's debug port.
#pragma once
#include <atomic>
#include <mutex>
#include <string>
#include <windows.h>
#include <winhttp.h>

std::wstring Widen(const std::string& s);
std::string Narrow(const std::wstring& s);

// GET http://127.0.0.1:<port><path>. Returns false if nothing answers.
bool HttpGet(int port, const std::wstring& path, std::string& body);

class WebSocket {
public:
	~WebSocket() { Close(); }
	bool Connect(int port, const std::wstring& path);
	bool Send(const std::string& text);
	bool Receive(std::string& out); // blocks; false once the socket is closed
	void Close();

private:
	HINTERNET session_ = nullptr, conn_ = nullptr;
	std::atomic<HINTERNET> ws_{nullptr};
	std::mutex sendMu_;
};

// GET any https:// address (follows redirects). Fails above maxBytes. err says why on failure.
bool HttpsGet(const std::string& url, std::string& body, std::string& err, size_t maxBytes = 200u << 20);
