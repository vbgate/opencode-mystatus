# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-01-14

### Added

- Support for GitHub Copilot account quota tracking (Premium requests)
- New `copilot.ts` module for GitHub internal API integration
- Updated `README.md` and `README.zh-CN.md` with Copilot documentation

## [1.0.1] - 2026-01-11

### Fixed

- Include `command/` directory in npm package for slash command support

## [1.0.0] - 2026-01-11

### Added

- Initial release
- Query OpenAI account quota (Plus/Team/Pro)
- Query Zhipu AI account quota (Coding Plan)
- Query Google Cloud account quota (Antigravity)
- Visual progress bars for quota display
- Multi-language support (Chinese/English)
- API key masking for security
