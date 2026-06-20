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
-- Name: budget_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_accounts (
    budget_id text NOT NULL,
    account_id text NOT NULL
);


--
-- Name: budget_accounts budget_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_accounts
    ADD CONSTRAINT budget_accounts_pkey PRIMARY KEY (budget_id, account_id);


--
-- Name: budget_accounts budget_accounts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_accounts
    ADD CONSTRAINT budget_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: budget_accounts budget_accounts_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_accounts
    ADD CONSTRAINT budget_accounts_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


