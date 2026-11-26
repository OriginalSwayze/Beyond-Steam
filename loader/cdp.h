// Chrome DevTools Protocol client over Steam's browser-level debug socket. Replies are matched to calls by id;
// events are handed to a small worker pool so handlers may make blocking calls of their own.
#pragma once
#include <condition_variable>
#include <deque>
#include <functional>
#include <map>
#include <memory>
#include <thread>
#include <vector>
#include "ws.h"
#include "../third_party/nlohmann/json.hpp"

using json = nlohmann::json;

std::string Dump(const json& j); // never throws on bad UTF-8

class Cdp {
public:
	~Cdp() { Stop(); }
	bool Connect(int port);
	void Run(); // reads until Steam closes the socket
	void Stop();
	// Blocking call. The result is the whole reply: {"result": ...} or {"error": ...}.
	json Call(const std::string& method, const json& params = json::object(), const std::string& session = "", int timeoutMs = 10000);
	void Post(const std::string& method, const json& params = json::object(), const std::string& session = ""); // fire and forget
	std::function<void(const json&)> onEvent;

private:
	struct Pending { std::mutex m; std::condition_variable cv; bool done = false; json reply; };
	WebSocket ws_;
	std::atomic<int> nextId_{1};
	std::mutex pmu_;
	std::map<int, std::shared_ptr<Pending>> pending_;
	std::mutex qmu_;
	std::condition_variable qcv_;
	std::deque<json> queue_;
	bool stopping_ = false;
	std::vector<std::thread> workers_;
};
