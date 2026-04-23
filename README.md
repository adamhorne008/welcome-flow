# Welcome Flow

A personalized onboarding questionnaire for Frive customers. This flow collects dietary preferences, health goals, split box preferences, and meal ratings to personalize the customer experience.

## 🎯 Features

- **Dietary Preferences**: Capture customer food preferences (vegan, vegetarian, dairy-free, etc.)
- **Health Goals**: 6 goal options (improve health, build muscle, lose weight, increase energy, improve gut health, support GLP-1)
- **Split Box Question**: For large orders, offer option to split delivery across two days
- **Meal Voting**: Rate 10 personalized meals with thumbs up/down
- **Conditional Incentivization**: Toggle £5 credit messaging on/off
- **Success Screen**: Thank you message with benefits showcase (Freya AI, Rewards, App)

## 🚀 Getting Started

### Prerequisites

- Supabase account and project
- Web server or local development environment

### Installation

1. Clone the repository:
\`\`\`bash
git clone https://github.com/adamhorne008/welcome-flow.git
cd welcome-flow
\`\`\`

2. Update Supabase credentials in \`personalization-flow.html\`

3. Set up database tables (see Database Setup section)

4. Open with order_id parameter:
\`\`\`
personalization-flow.html?order_id=127313
\`\`\`

## 📊 Database Setup

See inline comments in personalization-flow.html for required table schemas.

## 🎯 URL Parameters

- \`order_id\` (required): Customer order ID

## 📱 Responsive Design

- Mobile-first design
- Max-width 500px on desktop
- Touch-friendly UI

Built with ❤️ for Frive
