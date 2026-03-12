📸 Ajanta Photography Platform

A modern photography management platform that allows studios to manage clients, albums, galleries, and media delivery through a secure web application.

This platform enables photographers to upload event photos, organize albums, and share galleries with clients through secure access links.

⸻

🚀 Features

👤 Authentication
	•	Secure user authentication using Supabase Auth
	•	Role-based access control
	•	Admin and Client accounts

🖼️ Album & Gallery Management
	•	Create and manage client albums
	•	Upload large photo collections
	•	Automatic gallery display

☁️ Cloud Storage
	•	Media files stored on Cloudflare R2
	•	Fast global delivery via CDN
	•	Secure signed URL access

👨‍💼 Admin Dashboard

Admins can:
	•	Create client accounts
	•	Upload photos and videos
	•	Manage albums
	•	Monitor storage usage
	•	Handle edit requests

👤 Client Dashboard

Clients can:
	•	View event galleries
	•	Download photos
	•	Request photo edits
	•	Access shared albums

🔗 Secure Sharing
	•	Password-protected share links
	•	Expiring gallery access
	•	View/download tracking

⸻

🏗️ Architecture

Frontend and backend are separated using a modern cloud architecture.

Frontend communicates with Supabase services and Edge Functions which interact with Cloudflare R2 storage.

Frontend → Supabase → Edge Functions → Cloudflare R2

⸻

🧰 Tech Stack

Frontend
	•	React 18
	•	Vite
	•	TypeScript
	•	Tailwind CSS
	•	shadcn/ui
	•	React Router
	•	TanStack Query

Backend
	•	Supabase (PostgreSQL Database)
	•	Supabase Authentication
	•	Supabase Edge Functions (Deno)

Storage
	•	Cloudflare R2 Object Storage

Deployment
	•	Cloudflare Pages (Frontend)
	•	Supabase (Backend & Database)

⸻

📁 Project Structure

src/
 ├── components
 ├── pages
 ├── hooks
 ├── integrations
 │    └── supabase
 └── utils

supabase/
 ├── functions
 └── migrations


⸻

⚙️ Environment Variables

Create a .env file:

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

Edge functions require:

SUPABASE_SERVICE_ROLE_KEY
R2_ENDPOINT
R2_BUCKET_NAME
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY


⸻

🖥️ Running the Project

Install dependencies

npm install

Run development server

npm run dev

Build production version

npm run build


⸻

☁️ Deployment

Frontend

Deploy using Cloudflare Pages

Backend

Deploy Edge Functions with:

supabase functions deploy


⸻

📊 Database

Database is managed through Supabase PostgreSQL.

Main tables:
	•	albums
	•	media
	•	clients
	•	bookings
	•	quotations
	•	edit_requests
	•	user_roles
	•	share_links

⸻

🔒 Security
	•	Role-based access control
	•	Secure media access via signed URLs
	•	JWT-based authentication

⸻

📸 Use Case

This platform is designed for:
	•	Photography studios
	•	Wedding photographers
	•	Event photography businesses
	•	Media delivery platforms

⸻

📄 License

This project is for educational and portfolio purposes.

⸻

👨‍💻 Author

Developed by Aflah Cholayil

GitHub: https://github.com/aflah-cholayil
:::
