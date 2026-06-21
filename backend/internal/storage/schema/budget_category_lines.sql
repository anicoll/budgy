--
-- PostgreSQL database dump
--


-- Dumped from database version 15.18
-- Dumped by pg_dump version 15.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: budget_category_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_category_lines (
    budget_id text NOT NULL,
    category_id text NOT NULL,
    budgeted bigint DEFAULT 0 NOT NULL,
    balance bigint DEFAULT 0 NOT NULL,
    target_limit bigint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    budgeted_frequency text DEFAULT 'monthly'::text NOT NULL
);


--
-- Name: budget_category_lines budget_category_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_category_lines
    ADD CONSTRAINT budget_category_lines_pkey PRIMARY KEY (budget_id, category_id);


--
-- Name: budget_category_lines budget_category_lines_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_category_lines
    ADD CONSTRAINT budget_category_lines_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: budget_category_lines budget_category_lines_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_category_lines
    ADD CONSTRAINT budget_category_lines_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


