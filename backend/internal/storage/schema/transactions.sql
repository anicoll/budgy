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
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id text NOT NULL,
    budget_id text NOT NULL,
    account_id text NOT NULL,
    category_id text,
    amount bigint NOT NULL,
    description text NOT NULL,
    date timestamp without time zone NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


