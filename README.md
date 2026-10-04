# Hablu Support Library

Planning and research repository for Hablu Programmer's support knowledge system.

## Goal

Hablu Programmer's support team solves many student problems every day. This project will turn those daily support interactions into a searchable support database and reusable solution library.

The core idea is simple:

- Record who asked the question: student ID, name, email, course, batch, or any available identifier.
- Record what they asked: problem title, details, topic, course/batch/module context.
- Record how it was solved: text answer, files, screenshots, code samples, and video links.
- Reuse good answers later as solution articles.

## Documents

- [`docs/project-plan.md`](docs/project-plan.md) - product plan, MVP scope, data model, workflow, and open decisions.
- [`docs/full-build-plan.md`](docs/full-build-plan.md) - full technical build plan, feature roadmap, testing gates, and known gaps.
- [`docs/open-source-research.md`](docs/open-source-research.md) - open-source alternatives and fit analysis.

## Current Status

Planning and product investigation. No implementation has started yet.

## Working Decision

Start with a staff-first support log and solution library using MongoDB. File uploads are deferred; MVP stores external file links and video links only. Build feature-by-feature with verification after each feature.
