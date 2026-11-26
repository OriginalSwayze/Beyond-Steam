#include "cdp.h"

std::string Dump(const json& j) { return j.dump(-1, ' ', false, json::error_handler_t::replace); }

bool Cdp::Connect(int port) {
	std::string body;
	if (!HttpGet(port, L"/json/version", body)) return false;
	json v = json::parse(body, nullptr, false);
	if (v.is_discarded()) return false;
	std::string url = v.value("webSocketDebuggerUrl", "");
	size_t at = url.find("/devtools/");
	if (at == std::string::npos) return false;
	if (!ws_.Connect(port, Widen(url.substr(at)))) return false;
	stopping_ = false;
	for (int i = 0; i < 4; i++) {
		workers_.emplace_back([this] {
			for (;;) {
				json ev;
				{
					std::unique_lock<std::mutex> lock(qmu_);
					qcv_.wait(lock, [this] { return stopping_ || !queue_.empty(); });
					if (stopping_) return;
					ev = std::move(queue_.front());
					queue_.pop_front();
				}
				try { if (onEvent) onEvent(ev); } catch (...) {}
			}
		});
	}
	return true;
}

void Cdp::Run() {
	std::string text;
	while (ws_.Receive(text)) {
		json m = json::parse(text, nullptr, false);
		if (m.is_discarded()) continue;
		if (m.contains("id")) {
			std::shared_ptr<Pending> p;
			{
				std::lock_guard<std::mutex> lock(pmu_);
				auto it = pending_.find(m["id"].get<int>());
				if (it == pending_.end()) continue;
				p = it->second;
				pending_.erase(it);
			}
			std::lock_guard<std::mutex> lock(p->m);
			p->reply = std::move(m);
			p->done = true;
			p->cv.notify_all();
		} else {
			std::lock_guard<std::mutex> lock(qmu_);
			queue_.push_back(std::move(m));
			qcv_.notify_one();
		}
	}
	Stop();
}

void Cdp::Stop() {
	ws_.Close();
	{
		std::lock_guard<std::mutex> lock(qmu_);
		stopping_ = true;
		queue_.clear();
	}
	qcv_.notify_all();
	for (auto& t : workers_)
		if (t.joinable()) t.get_id() == std::this_thread::get_id() ? t.detach() : t.join();
	workers_.clear();
	std::lock_guard<std::mutex> lock(pmu_);
	for (auto& [id, p] : pending_) {
		std::lock_guard<std::mutex> pl(p->m);
		p->reply = {{"error", {{"message", "disconnected"}}}};
		p->done = true;
		p->cv.notify_all();
	}
	pending_.clear();
}

json Cdp::Call(const std::string& method, const json& params, const std::string& session, int timeoutMs) {
	int id = nextId_++;
	auto p = std::make_shared<Pending>();
	{
		std::lock_guard<std::mutex> lock(pmu_);
		pending_[id] = p;
	}
	json msg = {{"id", id}, {"method", method}, {"params", params}};
	if (!session.empty()) msg["sessionId"] = session;
	if (!ws_.Send(Dump(msg))) {
		std::lock_guard<std::mutex> lock(pmu_);
		pending_.erase(id);
		return {{"error", {{"message", "send failed"}}}};
	}
	std::unique_lock<std::mutex> lock(p->m);
	if (!p->cv.wait_for(lock, std::chrono::milliseconds(timeoutMs), [&] { return p->done; })) {
		std::lock_guard<std::mutex> pl(pmu_);
		pending_.erase(id);
		return {{"error", {{"message", "timeout"}}}};
	}
	return p->reply;
}

void Cdp::Post(const std::string& method, const json& params, const std::string& session) {
	json msg = {{"id", nextId_++}, {"method", method}, {"params", params}};
	if (!session.empty()) msg["sessionId"] = session;
	ws_.Send(Dump(msg));
}
