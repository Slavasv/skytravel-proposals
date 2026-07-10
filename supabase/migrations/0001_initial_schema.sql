--
-- PostgreSQL database dump
--

\restrict NcUzrFSRdQulL8pTSOs3iMISEa2Yh3dnWXjPNRS9aHZuSeWvXYbCE6GXWUs8cxr

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'manager')
  );
  return new;
end;
$$;


--
-- Name: increment_proposal_views(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_proposal_views(p_slug text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update proposals
  set views_count = views_count + 1,
      last_viewed_at = now()
  where slug = p_slug;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('owner', 'admin')
  );
$$;


--
-- Name: is_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_owner() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'owner'
  );
$$;


--
-- Name: my_company_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_company_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select company_id from profiles where id = auth.uid();
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country_id uuid NOT NULL,
    name_ru text NOT NULL,
    name_en text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    accent_color text,
    contact_email text,
    contact_phone text,
    website_url text,
    footer_note text,
    socials jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    office_address text,
    tagline text,
    greeting_message text,
    voucher_template integer DEFAULT 1,
    voucher_bg_url text
);


--
-- Name: content_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    title_ru text,
    title_en text,
    description_ru text,
    description_en text,
    image_url text,
    location text,
    tags text[],
    meta jsonb,
    notable_amenities_ru text,
    notable_amenities_en text,
    duration_hours numeric,
    best_season_ru text,
    best_season_en text,
    vehicle_ru text,
    vehicle_en text,
    duration_min integer,
    max_passengers integer,
    notable_ru text,
    notable_en text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    archived_at timestamp with time zone,
    country_id uuid,
    city_id uuid,
    images jsonb DEFAULT '[]'::jsonb,
    facts_ru text,
    facts_en text,
    rooms jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT content_blocks_type_check CHECK ((type = ANY (ARRAY['hotel'::text, 'activity'::text, 'transfer'::text, 'city'::text])))
);


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name_ru text NOT NULL,
    name_en text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: day_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.day_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    day_id uuid,
    block_id uuid,
    sort_order integer DEFAULT 0,
    custom_note_ru text,
    custom_note_en text,
    room_type_ru text,
    room_type_en text,
    from_ru text,
    from_en text,
    to_ru text,
    to_en text
);


--
-- Name: days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid,
    day_number integer NOT NULL,
    title_ru text,
    title_en text,
    date date,
    intro_text_ru text,
    intro_text_en text
);


--
-- Name: destination_section_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.destination_section_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid NOT NULL,
    block_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: destination_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.destination_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    type text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    title_ru text,
    title_en text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    city_block_id uuid,
    hotel_block_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'manager'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    company_id uuid,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['superadmin'::text, 'owner'::text, 'admin'::text, 'manager'::text])))
);


--
-- Name: proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    client_name_ru text,
    client_name_en text,
    trip_title_ru text,
    trip_title_en text,
    guest_count integer,
    start_date date,
    end_date date,
    status text DEFAULT 'draft'::text,
    total_price numeric,
    currency text DEFAULT 'USD'::text,
    cover_image_url text,
    intro_text_ru text,
    intro_text_en text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    owner_id uuid,
    views_count integer DEFAULT 0 NOT NULL,
    last_viewed_at timestamp with time zone,
    company_id uuid,
    payment_terms_ru text,
    payment_terms_en text,
    cancellation_policy_ru text,
    cancellation_policy_en text,
    cost_currency text,
    cost_includes_ru text,
    cost_includes_en text,
    cost_excludes_ru text,
    cost_excludes_en text,
    cost_notes_ru text,
    cost_notes_en text,
    cost_lines jsonb DEFAULT '[]'::jsonb,
    kind text DEFAULT 'individual'::text NOT NULL,
    season_ru text,
    season_en text,
    tagline_ru text,
    tagline_en text,
    price_from boolean DEFAULT false NOT NULL,
    CONSTRAINT proposals_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'AED'::text, 'GBP'::text]))),
    CONSTRAINT proposals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'confirmed'::text])))
);


--
-- Name: voucher_hotels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voucher_hotels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    city text,
    name text,
    address text,
    phone text,
    check_in text,
    check_out text,
    nights text,
    room_type text,
    meal_plan text,
    extras text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    country text,
    booking_ref text
);


--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    owner_id uuid,
    slug text,
    voucher_no text,
    issue_date text,
    booking_ref text,
    guests jsonb DEFAULT '[]'::jsonb NOT NULL,
    show_transfer boolean DEFAULT false NOT NULL,
    transfers jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    greeting_for text,
    show_greeting boolean DEFAULT false NOT NULL
);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: companies companies_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_slug_key UNIQUE (slug);


--
-- Name: content_blocks content_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_blocks
    ADD CONSTRAINT content_blocks_pkey PRIMARY KEY (id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: day_blocks day_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_blocks
    ADD CONSTRAINT day_blocks_pkey PRIMARY KEY (id);


--
-- Name: days days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.days
    ADD CONSTRAINT days_pkey PRIMARY KEY (id);


--
-- Name: destination_section_blocks destination_section_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destination_section_blocks
    ADD CONSTRAINT destination_section_blocks_pkey PRIMARY KEY (id);


--
-- Name: destination_sections destination_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destination_sections
    ADD CONSTRAINT destination_sections_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_slug_key UNIQUE (slug);


--
-- Name: voucher_hotels voucher_hotels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_hotels
    ADD CONSTRAINT voucher_hotels_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_slug_key UNIQUE (slug);


--
-- Name: content_blocks_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_blocks_tags_idx ON public.content_blocks USING gin (tags);


--
-- Name: day_blocks_day_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX day_blocks_day_id_idx ON public.day_blocks USING btree (day_id);


--
-- Name: days_proposal_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX days_proposal_id_idx ON public.days USING btree (proposal_id);


--
-- Name: idx_destination_section_blocks_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_destination_section_blocks_section ON public.destination_section_blocks USING btree (section_id, sort_order);


--
-- Name: idx_destination_sections_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_destination_sections_proposal ON public.destination_sections USING btree (proposal_id, sort_order);


--
-- Name: idx_voucher_hotels_voucher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_hotels_voucher ON public.voucher_hotels USING btree (voucher_id, sort_order);


--
-- Name: idx_vouchers_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_company ON public.vouchers USING btree (company_id, updated_at DESC);


--
-- Name: idx_vouchers_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_slug ON public.vouchers USING btree (slug);


--
-- Name: cities cities_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE RESTRICT;


--
-- Name: content_blocks content_blocks_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_blocks
    ADD CONSTRAINT content_blocks_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;


--
-- Name: content_blocks content_blocks_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_blocks
    ADD CONSTRAINT content_blocks_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE SET NULL;


--
-- Name: day_blocks day_blocks_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_blocks
    ADD CONSTRAINT day_blocks_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.content_blocks(id) ON DELETE RESTRICT;


--
-- Name: day_blocks day_blocks_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_blocks
    ADD CONSTRAINT day_blocks_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.days(id) ON DELETE CASCADE;


--
-- Name: days days_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.days
    ADD CONSTRAINT days_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: destination_section_blocks destination_section_blocks_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destination_section_blocks
    ADD CONSTRAINT destination_section_blocks_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.content_blocks(id) ON DELETE CASCADE;


--
-- Name: destination_section_blocks destination_section_blocks_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destination_section_blocks
    ADD CONSTRAINT destination_section_blocks_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.destination_sections(id) ON DELETE CASCADE;


--
-- Name: destination_sections destination_sections_city_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destination_sections
    ADD CONSTRAINT destination_sections_city_block_id_fkey FOREIGN KEY (city_block_id) REFERENCES public.content_blocks(id) ON DELETE SET NULL;


--
-- Name: destination_sections destination_sections_hotel_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destination_sections
    ADD CONSTRAINT destination_sections_hotel_block_id_fkey FOREIGN KEY (hotel_block_id) REFERENCES public.content_blocks(id) ON DELETE SET NULL;


--
-- Name: destination_sections destination_sections_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destination_sections
    ADD CONSTRAINT destination_sections_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: proposals proposals_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: proposals proposals_owner_id_fkey_profiles; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_owner_id_fkey_profiles FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: voucher_hotels voucher_hotels_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_hotels
    ADD CONSTRAINT voucher_hotels_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE CASCADE;


--
-- Name: vouchers vouchers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: vouchers vouchers_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_owner_fk FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: cities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

--
-- Name: cities cities insert authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cities insert authenticated" ON public.cities FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: cities cities read public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cities read public" ON public.cities FOR SELECT USING (true);


--
-- Name: cities cities update authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cities update authenticated" ON public.cities FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: companies companies are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "companies are publicly readable" ON public.companies FOR SELECT USING (true);


--
-- Name: companies companies_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_update ON public.companies FOR UPDATE USING ((public.is_owner() AND (id = public.my_company_id()))) WITH CHECK ((public.is_owner() AND (id = public.my_company_id())));


--
-- Name: content_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: content_blocks content_blocks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_blocks_delete ON public.content_blocks FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: content_blocks content_blocks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_blocks_insert ON public.content_blocks FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: content_blocks content_blocks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_blocks_select ON public.content_blocks FOR SELECT USING (true);


--
-- Name: content_blocks content_blocks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_blocks_update ON public.content_blocks FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: countries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

--
-- Name: countries countries insert authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "countries insert authenticated" ON public.countries FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: countries countries read public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "countries read public" ON public.countries FOR SELECT USING (true);


--
-- Name: countries countries update authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "countries update authenticated" ON public.countries FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: day_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.day_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: day_blocks day_blocks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_blocks_delete ON public.day_blocks FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.days
     JOIN public.proposals ON ((proposals.id = days.proposal_id)))
  WHERE ((days.id = day_blocks.day_id) AND ((proposals.owner_id = auth.uid()) OR public.is_admin())))));


--
-- Name: day_blocks day_blocks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_blocks_insert ON public.day_blocks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.days
     JOIN public.proposals ON ((proposals.id = days.proposal_id)))
  WHERE ((days.id = day_blocks.day_id) AND ((proposals.owner_id = auth.uid()) OR public.is_admin())))));


--
-- Name: day_blocks day_blocks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_blocks_select ON public.day_blocks FOR SELECT USING (true);


--
-- Name: day_blocks day_blocks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_blocks_update ON public.day_blocks FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.days
     JOIN public.proposals ON ((proposals.id = days.proposal_id)))
  WHERE ((days.id = day_blocks.day_id) AND ((proposals.owner_id = auth.uid()) OR public.is_admin())))));


--
-- Name: days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;

--
-- Name: days days_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY days_delete ON public.days FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.proposals
  WHERE ((proposals.id = days.proposal_id) AND ((proposals.owner_id = auth.uid()) OR public.is_admin())))));


--
-- Name: days days_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY days_insert ON public.days FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.proposals
  WHERE ((proposals.id = days.proposal_id) AND ((proposals.owner_id = auth.uid()) OR public.is_admin())))));


--
-- Name: days days_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY days_select ON public.days FOR SELECT USING (true);


--
-- Name: days days_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY days_update ON public.days FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.proposals
  WHERE ((proposals.id = days.proposal_id) AND ((proposals.owner_id = auth.uid()) OR public.is_admin())))));


--
-- Name: destination_section_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.destination_section_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: destination_section_blocks destination_section_blocks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY destination_section_blocks_delete ON public.destination_section_blocks FOR DELETE USING (true);


--
-- Name: destination_section_blocks destination_section_blocks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY destination_section_blocks_insert ON public.destination_section_blocks FOR INSERT WITH CHECK (true);


--
-- Name: destination_section_blocks destination_section_blocks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY destination_section_blocks_select ON public.destination_section_blocks FOR SELECT USING (true);


--
-- Name: destination_section_blocks destination_section_blocks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY destination_section_blocks_update ON public.destination_section_blocks FOR UPDATE USING (true);


--
-- Name: destination_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.destination_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: destination_sections destination_sections_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY destination_sections_delete ON public.destination_sections FOR DELETE USING (true);


--
-- Name: destination_sections destination_sections_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY destination_sections_insert ON public.destination_sections FOR INSERT WITH CHECK (true);


--
-- Name: destination_sections destination_sections_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY destination_sections_select ON public.destination_sections FOR SELECT USING (true);


--
-- Name: destination_sections destination_sections_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY destination_sections_update ON public.destination_sections FOR UPDATE USING (true);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (((id = auth.uid()) OR public.is_admin()));


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (((id = auth.uid()) OR public.is_admin()));


--
-- Name: proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: proposals proposals_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_delete ON public.proposals FOR DELETE USING (((owner_id = auth.uid()) OR (public.is_admin() AND (company_id = public.my_company_id()))));


--
-- Name: proposals proposals_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_insert ON public.proposals FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: proposals proposals_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_select ON public.proposals FOR SELECT USING (((auth.uid() IS NULL) OR (owner_id = auth.uid()) OR (public.is_admin() AND (company_id = public.my_company_id()))));


--
-- Name: proposals proposals_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_update ON public.proposals FOR UPDATE USING (((owner_id = auth.uid()) OR (public.is_admin() AND (company_id = public.my_company_id()))));


--
-- Name: voucher_hotels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.voucher_hotels ENABLE ROW LEVEL SECURITY;

--
-- Name: voucher_hotels voucher_hotels_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voucher_hotels_delete ON public.voucher_hotels FOR DELETE USING (true);


--
-- Name: voucher_hotels voucher_hotels_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voucher_hotels_insert ON public.voucher_hotels FOR INSERT WITH CHECK (true);


--
-- Name: voucher_hotels voucher_hotels_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voucher_hotels_select ON public.voucher_hotels FOR SELECT USING (true);


--
-- Name: voucher_hotels voucher_hotels_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voucher_hotels_update ON public.voucher_hotels FOR UPDATE USING (true);


--
-- Name: vouchers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

--
-- Name: vouchers vouchers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vouchers_delete ON public.vouchers FOR DELETE USING (true);


--
-- Name: vouchers vouchers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vouchers_insert ON public.vouchers FOR INSERT WITH CHECK (true);


--
-- Name: vouchers vouchers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vouchers_select ON public.vouchers FOR SELECT USING (true);


--
-- Name: vouchers vouchers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vouchers_update ON public.vouchers FOR UPDATE USING (true);


--
-- PostgreSQL database dump complete
--

\unrestrict NcUzrFSRdQulL8pTSOs3iMISEa2Yh3dnWXjPNRS9aHZuSeWvXYbCE6GXWUs8cxr

