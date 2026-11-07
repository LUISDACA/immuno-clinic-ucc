import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ThemeModeSelector } from '../theme-toggle';
import { Badge } from '../ui/badge';
import { Alert } from '../ui/alert';
import { useApplyTheme, useThemeStore } from '@/lib/theme/store';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  useThemeStore.setState({mode:'system',isHydrated:false});
});

it('announces one selected theme and preserves selection in the existing preference format', () => {
  renderHook(useApplyTheme);
  render(<ThemeModeSelector />);
  const group = within(screen.getByRole('group', {name:'Tema de apariencia'}));
  expect(group.getByRole('button',{name:'Auto',pressed:true})).toBeVisible();
  fireEvent.click(group.getByRole('button',{name:'Oscuro'}));
  expect(group.getByRole('button',{name:'Oscuro',pressed:true})).toBeVisible();
  expect(group.getAllByRole('button',{pressed:true})).toHaveLength(1);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(JSON.parse(localStorage.getItem('ic_theme')!).state.mode).toBe('dark');
});

it('uses system when storage is unavailable and permits a manual choice without storage', () => {
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Disabled storage');});
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Disabled storage');});
  renderHook(useApplyTheme);
  expect(document.documentElement.dataset.theme).toBe('system');
  act(()=>useThemeStore.getState().setMode('light'));
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('activates the focused light theme with Enter and persists the choice', async () => {
  const user = userEvent.setup();
  renderHook(useApplyTheme);
  render(<ThemeModeSelector />);
  await user.tab();
  await user.tab();
  const light = screen.getByRole('button', { name: 'Claro' });
  expect(light).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(light).toHaveAttribute('aria-pressed', 'true');
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(JSON.parse(localStorage.getItem('ic_theme')!).state.mode).toBe('light');
});

it.each(['success','warning','destructive','info'] as const)('badge %s follows semantic theme tokens and preserves its label', variant => {
  render(<Badge variant={variant}>Synthetic status</Badge>);
  const badge=screen.getByText('Synthetic status');
  expect(badge.className).toContain(`var(--${variant}-text)`);
  expect(badge.className).not.toContain('dark:');
});

it.each(['error','warning','success','info'] as const)('alert %s preserves live semantics and text', tone => {
  render(<Alert tone={tone}>Synthetic feedback</Alert>);
  const alert=screen.getByRole(tone==='error'||tone==='warning'?'alert':'status');
  expect(alert).toHaveTextContent('Synthetic feedback');
  expect(alert.className).toContain(`var(--${tone==='error'?'destructive':tone}-text)`);
});

const source=readFileSync('src/app/layout.tsx','utf8');
const init=source.match(/const themeInitScript = `([\s\S]*?)`;/)![1];
it.each([
  ['{"state":{"mode":"dark"}}','dark'],
  ['{"state":{"mode":"light"}}','light'],
  ['{"state":{"mode":"system"}}','system'],
  ['{"state":{"mode":"sepia"}}','system'],
  ['{"state":{"mode":{}}}','system'],
  ['malformed','system'],
] as const)('pre-hydration script validates stored preference %s', (raw,expected) => {
  const setAttribute=vi.fn();
  runInNewContext(init,{localStorage:{getItem:()=>raw},document:{documentElement:{setAttribute}}});
  expect(setAttribute).toHaveBeenCalledWith('data-theme',expected);
});
