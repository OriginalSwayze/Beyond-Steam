cmake_minimum_required(VERSION 3.20)
project(BeyondSteam CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
# Static runtime: the .exe runs on any Windows 10/11 PC without installing anything.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

add_executable(BeyondSteam WIN32
	loader/main.cpp loader/app.cpp loader/cdp.cpp loader/ws.cpp loader/http.cpp)
target_compile_definitions(BeyondSteam PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX _CRT_SECURE_NO_WARNINGS)
target_compile_options(BeyondSteam PRIVATE /utf-8 /W3 /EHsc)
target_link_libraries(BeyondSteam PRIVATE winhttp ws2_32 shell32 advapi32 ole32)
