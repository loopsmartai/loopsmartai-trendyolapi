# LoopSmart AI 
LoopSmart AI chat service working with Trendyol API

# Trendyol Chatbase Integration & Manual Approval System

## Overview
This project integrates Trendyol's customer questions API with Chatbase's AI chatbot to automatically generate answers and then allows manual approval before posting the answer back to Trendyol. It continuously polls for new questions, uses Chatbase to generate responses, and provides a web-based UI for reviewing, editing, and approving/rejecting each answer.

## Features
- **Continuous Polling:**  
  Polls Trendyol every 30 seconds for questions with status `WAITING_FOR_ANSWER`.

- **Persistent Storage:**  
  Processed question IDs are saved to a JSON file (`processedQuestions.json`) so that questions are not reprocessed after a restart.

- **Rate Limiting & Error Recovery:**  
  All API requests (to Trendyol and Chatbase) are managed through a rate limiter with a 1-second interval and include retry logic with exponential backoff to handle transient errors.

- **Chatbase Integration:**
    - Uses the latest Chatbase API endpoint: `https://www.chatbase.co/api/v1/chat`
    - Sends a request payload with a `messages` array, `chatbotId`, `stream` (set to `false`), and `temperature` parameters.
    - Parses the generated answer from `response.data.text`.

- **Manual Approval UI:**
    - **Pending Questions List:**  
      A web interface (`/pending` route) shows all pending questions that need manual approval.
    - **Approval Page:**  
      For each question (accessed via `/approval/:id`), the Chatbase-generated answer is displayed. You can edit the answer and then either approve (to post it to Trendyol) or reject it.
    - Processing is blocked until the current approval is handled, ensuring you can review one question at a time.

## Changes & Enhancements
- **Time Check Removed:**  
  The previous time-based processing (e.g., answering only between 12am and 8am) has been removed so questions can be answered at any time.

- **Polling Interval Updated:**  
  The polling interval has been updated from 60 seconds to 30 seconds.

- **Chatbase API Update:**  
  Updated the integration to match the latest Chatbase documentation:
    - Changed endpoint to `https://www.chatbase.co/api/v1/chat`
    - Updated request headers to use the Authorization header with a Bearer token.
    - Updated request payload to include a `messages` array and `chatbotId`.
    - Response parsing now extracts the answer from `response.data.text`.

- **Multiple Pending Questions & Manual Selection:**  
  Instead of processing a single question at a time, the app now accumulates multiple pending questions in a list (accessible via the `/pending` route) so that you can select which one to review.

## Setup & Deployment

### Requirements
- Node.js (LTS version recommended)
- NPM packages: `axios`, `express`, `body-parser`
- A paid Replit Core account (to ensure the repl stays running continuously)

### Configuration
Update the following constants in your code or use environment variables:
- **Trendyol API Credentials:**
    - `TRENDYOL_CLIENT_ID`
    - `TRENDYOL_API_KEY`
    - `TRENDYOL_API_SECRET`
    - `TRENDYOL_TOKEN`
- **Chatbase API Credentials:**
    - `CHATBASE_SECRET_KEY` (your Chatbase secret key)
    - `CHATBASE_CHATBOT_ID` (your Chatbase chatbot ID)
- **Product Filter:**
    - `TARGET_PRODUCT_NAME` – The product name to filter questions.

### Running Locally
1. Install dependencies:
   ```bash
   npm install axios express body-parser
