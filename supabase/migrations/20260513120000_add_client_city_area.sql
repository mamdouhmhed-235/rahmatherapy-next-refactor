-- Migration: add city and area columns to clients table
-- Date: 2026-05-13
-- Purpose: support city/area pre-fill in booking-new form

alter table public.clients
  add column if not exists city text,
  add column if not exists area text;
