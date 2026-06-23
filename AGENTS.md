# AGENTS.md

# Nagrik - AI Civic Operations Platform

This document contains the complete project context, architecture decisions, coding standards, agent behaviors, and implementation constraints for Nagrik.

Read this file before generating, modifying, or refactoring any code.

---

# Project Overview

Nagrik is an AI-powered civic operations platform that transforms citizen infrastructure reports into verified, prioritized, routed, tracked, and escalated civic tickets.

The platform exists to solve the report-to-resolution gap that causes most civic reporting applications to fail.

The system is intentionally designed around autonomous AI agents rather than simple AI features.

Core principle:

A citizen should only need to report an issue once.

The system should handle:

* Understanding
* Verification
* Prioritization
* Routing
* Tracking
* Escalation

without requiring manual intervention.

---

# Primary Judging Objective

This project is being built for a hackathon where Agentic Depth is one of the highest scoring categories.

When making implementation decisions, prioritize:

1. Autonomous decision making
2. Agent workflows
3. Multi-agent interactions
4. Closed-loop execution

over flashy UI features.

Never reduce agent responsibilities.

---

# Agent Architecture

The system contains four independent agents.

## Intake Agent

Purpose:

Transform raw citizen reports into structured issue records.

Input:

* Image
* Video
* Voice Note
* GPS Coordinates

Responsibilities:

* Classify issue category
* Determine severity
* Estimate scale
* Extract landmarks
* Validate location

Output:

{
category,
severity,
confidence,
landmarks,
summary
}

Gemini should always return structured JSON.

---

## Verification Agent

Purpose:

Determine whether a report is new or belongs to an existing issue.

Responsibilities:

* Search nearby issues
* Compare categories
* Compare timestamps
* Compare image similarity
* Merge duplicates
* Increase urgency score

Rules:

IF

distance <= 50m
AND category matches
AND similarity > 80%

THEN merge.

ELSE create new issue thread.

Never create duplicate issue threads when merge confidence is high.

---

## Routing Agent

Purpose:

Send verified issues to the correct civic authority.

Responsibilities:

* Determine ward
* Determine locality
* Determine department
* Generate complaint

Output:

{
department,
ward,
complaint
}

Complaint must be professional and government-facing.

Never use casual language.

---

## Escalation Agent

Purpose:

Ensure issues do not stagnate.

Responsibilities:

* Monitor SLA
* Detect breaches
* Draft follow-up notices
* Increase visibility
* Notify subscribers

Escalation levels:

Level 1
Reminder

Level 2
Public escalation

Level 3
Critical escalation

Every escalation must generate an audit record.

---

# Tech Stack

Frontend:

* React 19
* TypeScript
* Vite
* Tailwind CSS
* Shadcn UI
* React Query
* React Router

Backend:

* Firebase Auth
* Firestore
* Firebase Storage
* Cloud Functions

AI:

* Gemini 2.5 Flash
* Gemini Vision

Maps:

* Google Maps API
* Places API

Charts:

* Recharts

Deployment:

* Firebase Hosting

---

# Folder Structure

src/

app/

components/

features/

agents/

intake/

verification/

routing/

escalation/

services/

firebase/

gemini/

maps/

types/

hooks/

pages/

utils/

constants/

---

# Firestore Collections

users

issues

threads

departments

complaints

escalations

notifications

leaderboards

---

# Status Lifecycle

Issue statuses:

REPORTED

VERIFIED

ROUTED

IN_PROGRESS

ESCALATED

RESOLVED

Never skip status transitions.

All transitions must be logged.

---

# Severity Levels

LOW

MEDIUM

HIGH

CRITICAL

Severity affects:

* Dashboard ranking
* Escalation speed
* SLA duration

---

# SLA Rules

Garbage

3 days

Streetlight

5 days

Pothole

7 days

Water Leakage

2 days

Critical Infrastructure

24 hours

These values should remain configurable.

Never hardcode in components.

---

# Dashboard Requirements

Display:

* Total reports
* Open issues
* Resolved issues
* Escalated issues
* Resolution rate
* Average resolution time
* Heatmap
* Category breakdown
* Top affected wards

Dashboard updates must be realtime.

Use Firestore listeners.

---

# Map Requirements

Every issue must:

* Have coordinates
* Be represented on map
* Support clustering
* Support filtering

Filters:

* Severity
* Status
* Category
* Ward

---

# UI Principles

The product should feel:

* Trustworthy
* Government-grade
* Modern
* Clean
* Mobile-first

Avoid:

* Excessive animations
* Gaming aesthetics
* Neon themes

Prefer:

* Simple cards
* Strong typography
* Clear status indicators

---

# AI Prompting Rules

Always force JSON output.

Never return markdown.

Never return prose.

Use strict schemas.

Validate all Gemini responses before storage.

Retry malformed responses.

---

# Security Rules

Users may only:

* Edit their own reports
* Delete their own reports

Admins may:

* Moderate reports
* Resolve reports
* Manage departments

Never expose Firebase admin credentials.

Never expose API keys.

Use environment variables.

---

# Performance Goals

Initial load:

< 3 seconds

Issue creation:

< 5 seconds

Dashboard render:

< 2 seconds

Map render:

< 3 seconds

---

# Non Goals

Do NOT build:

* Payment systems
* Chat systems
* Social media feeds
* Complex RBAC
* Government integrations

Focus only on:

Report → Verify → Route → Escalate → Resolve

This workflow is the core product.

---

# Success Definition

A successful demo must show:

Citizen A reports issue

↓

Intake Agent classifies issue

↓

Citizen B reports same issue

↓

Verification Agent merges issue

↓

Urgency increases

↓

Routing Agent generates complaint

↓

Issue appears on dashboard

↓

SLA expires

↓

Escalation Agent generates follow-up

↓

Dashboard updates

This entire lifecycle is the product.
