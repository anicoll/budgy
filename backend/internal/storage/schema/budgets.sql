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
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id text NOT NULL,
    name text NOT NULL,
    method text NOT NULL,
    currency text NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--


