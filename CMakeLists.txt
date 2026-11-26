cmake_minimum_required(VERSION 3.20)
# CMake's resource-dependency helper breaks on folder names with spaces ("Beyond Steam"); dependencies are listed below instead.
set(CMAKE_NINJA_CMCLDEPS_RC OFF)
project(BeyondSteam CXX RC)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
# Static runtime: the .exe runs on any Windows 10/11 PC without installing anything.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

add_executable(BeyondSteam WIN32
	loader/main.cpp loader/app.cpp loader/cdp.cpp loader/ws.cpp loader/http.cpp loader/setup.cpp loader/features.cpp loader/res.rc)
target_compile_definitions(BeyondSteam PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX _CRT_SECURE_NO_WARNINGS)
target_compile_options(BeyondSteam PRIVATE $<$<COMPILE_LANGUAGE:CXX>:/utf-8 /W3 /EHsc>)
target_link_libraries(BeyondSteam PRIVATE winhttp ws2_32 shell32 advapi32 ole32 uuid comdlg32)
# Rebuild the resources when the files they embed change.
set_source_files_properties(loader/res.rc PROPERTIES OBJECT_DEPENDS
	"${CMAKE_SOURCE_DIR}/web/boot.js;${CMAKE_SOURCE_DIR}/web/manager.js;${CMAKE_SOURCE_DIR}/catalog/catalog.json;${CMAKE_SOURCE_DIR}/loader/beyondsteam.ico")
