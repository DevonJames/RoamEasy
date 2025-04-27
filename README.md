# RoamEasy

RoamEasy is a mobile app for RV travelers to plan multi-stop routes and get smart resort suggestions based on their preferences.

## Getting Started

### Prerequisites

- Node.js v20.2.1 or higher
- Yarn v1.22.x
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator or Android Emulator
- Supabase account

### Environment Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/RoamEasy.git
   cd RoamEasy
   ```

2. Install dependencies:
   ```
   npm install --legacy-peer-deps
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`:
     ```
     cp .env.example .env
     ```
   - Fill in your API keys:
     - `GOOGLE_MAPS_API_KEY`: Your Google Maps API key
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `OPENROUTE_SERVICE_API_KEY`: Your OpenRouteService API key (optional)
     - `SUPABASE_URL`: Your Supabase project URL 
     - `SUPABASE_ANON_KEY`: Your Supabase anon/public key

### Setting up Supabase

1. Create a new Supabase project at [https://supabase.com](https://supabase.com)
2. After project creation, go to Project Settings -> API to find your:
   - Project URL: Enter this as `SUPABASE_URL` in `.env`
   - `anon` public key: Enter this as `SUPABASE_ANON_KEY` in `.env`
3. Set up the database schema:
   - Go to SQL Editor
   - Run the following SQL code to create the basic tables:

```sql
-- Users and Profiles
create table if not exists public.users (
  id uuid primary key,
  email text unique not null,
  created_at timestamp default now()
);

create table if not exists public.user_profiles (
  user_id uuid references public.users(id),
  full_name text,
  is_guest boolean default false,
  created_at timestamp default now(),
  primary key(user_id)
);

-- Preferences
create table if not exists public.preferences (
  id serial primary key,
  user_id uuid references public.users(id),
  data jsonb not null,
  updated_at timestamp default now()
);

-- Trips and Stops
create table if not exists public.trips (
  id uuid primary key,
  user_id uuid references public.users(id),
  name text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists public.trip_stops (
  id uuid primary key,
  trip_id uuid references public.trips(id),
  resort_id uuid references public.resorts(id),
  stop_order int,
  check_in date,
  check_out date,
  notes text
);

-- Resorts Cache
create table if not exists public.resorts (
  id uuid primary key,
  name text,
  address text,
  latitude numeric,
  longitude numeric,
  rating numeric,
  amenities jsonb,
  phone text,
  website text,
  last_updated timestamp default now()
);
```

4. Set up Row Level Security:
   - In SQL Editor, run:
     ```sql
     -- Enable Row Level Security on tables
     alter table public.trips enable row level security;
     alter table public.trip_stops enable row level security;
     alter table public.preferences enable row level security;
     
     -- Create access policies
     create policy "Users can only access their own trips"
       on public.trips for all
       using (auth.uid() = user_id);
       
     create policy "Users can only access their own trip stops"
       on public.trip_stops for all
       using (trip_id in (select id from public.trips where user_id = auth.uid()));
       
     create policy "Users can only access their own preferences"
       on public.preferences for all
       using (user_id = auth.uid());
     ```

### Running the App

1. Start the development server:
   ```
   npm start
   ```

2. Press:
   - `i` to open in iOS Simulator
   - `a` to open in Android Emulator

## Features

- Smart route planning with daily driving limits
- Resort recommendations based on user preferences
- Offline map and data caching
- Trip export to calendar
- Email sharing 