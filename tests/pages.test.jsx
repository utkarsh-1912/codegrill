import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthPage } from '../src/AuthPage.jsx';
import { ProfilePage } from '../src/ProfilePage.jsx';
import { PublicPortfolioPage } from '../src/PublicPortfolioPage.jsx';
import { SheetsPage } from '../src/SheetsPage.jsx';
import { BUILTIN_SHEETS } from '../src/sheets.mjs';

const SAMPLE_CATEGORIES = [
  {
    id: 'arrays-hashing',
    stage: 1,
    names: { en: 'Arrays & Hashing' },
    descriptions: { en: 'Core array and map patterns' },
    prerequisites: [],
  },
];

const SAMPLE_PROBLEMS = [
  {
    slug: 'two-sum',
    leetcode_id: 1,
    category_id: 'arrays-hashing',
    difficulty: 'Easy',
    translations: { en: { title: 'Two Sum', summary: 'Hash map complement lookup' } },
    approach: { en: 'Hash map complement lookup' },
    complexity: { time: 'O(n)', space: 'O(n)' },
    resources: [],
  },
  {
    slug: 'group-anagrams',
    leetcode_id: 49,
    category_id: 'arrays-hashing',
    difficulty: 'Medium',
    translations: { en: { title: 'Group Anagrams', summary: 'Canonical frequency key' } },
    approach: { en: 'Canonical frequency key' },
    complexity: { time: 'O(nk)', space: 'O(nk)' },
    resources: [],
  },
];

describe('AuthPage', () => {
  it('switches between Sign in and Create account tabs and activates mascot shield on password focus', () => {
    render(<AuthPage mode="login" locale="en" onNavigate={vi.fn()} />);

    expect(screen.getByText('Welcome back to the forge')).toBeInTheDocument();

    const signupTab = screen.getByRole('tab', { name: /create account/i });
    fireEvent.click(signupTab);
    expect(screen.getByText('Ready to sync your journey')).toBeInTheDocument();

    const passwordInput = screen.getByPlaceholderText('••••••••');
    fireEvent.focus(passwordInput);
    expect(screen.getByText('Privacy shield active')).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('renders signed-in summary card when authSession is present', () => {
    const onNavigate = vi.fn();
    render(
      <AuthPage
        mode="login"
        locale="en"
        authSession={{ uid: 'u1', email: 'dev@example.com', displayName: 'Dev User', idToken: 'tok' }}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Dev User' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /profile/i }));
    expect(onNavigate).toHaveBeenCalledWith('/profile');
  });
});

describe('ProfilePage', () => {
  it('renders hero KPIs, cloud sync status, and public portfolio controls', () => {
    const onUpdatePortfolioSettings = vi.fn().mockResolvedValue({ handle: 'utkarsh', isPublicProfile: true });
    render(
      <ProfilePage
        problems={SAMPLE_PROBLEMS}
        categories={SAMPLE_CATEGORIES}
        completed={new Set(['two-sum'])}
        bookmarked={new Set(['group-anagrams'])}
        activity={{ '2026-11-28': 1 }}
        streak={3}
        longestStreak={5}
        backendOnline={true}
        authSession={{ uid: 'u1', email: 'dev@example.com', idToken: 'tok' }}
        portfolioSettings={{ handle: 'utkarsh', isPublicProfile: true }}
        onUpdatePortfolioSettings={onUpdatePortfolioSettings}
        locale="en"
        defaultLocale="en"
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText(/dev@example\.com/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /\/u\/utkarsh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save portfolio/i })).toBeInTheDocument();
  });
});

describe('PublicPortfolioPage', () => {
  it('renders public portfolio preview metrics and handle for /u/me', () => {
    render(
      <PublicPortfolioPage
        handle="me"
        problems={SAMPLE_PROBLEMS}
        completed={new Set(['two-sum'])}
        activity={{ '2026-11-28': 2 }}
        streak={4}
        longestStreak={7}
        linkedProfiles={{ github: { handle: 'octocat', solved: 42 } }}
        locale="en"
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText(/4d/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /@octocat/i })).toBeInTheDocument();
  });
});

describe('SheetsPage', () => {
  it('renders curated sheets and toggles problem completion', () => {
    const toggleComplete = vi.fn();
    const customSheets = [
      {
        ...BUILTIN_SHEETS[0],
        id: 'test-sheet',
        names: { en: 'Test Interview Sheet' },
        descriptions: { en: 'Focused practice set' },
        slugs: ['two-sum', 'group-anagrams'],
      },
    ];

    render(
      <SheetsPage
        sheets={customSheets}
        problems={SAMPLE_PROBLEMS}
        categories={SAMPLE_CATEGORIES}
        languages={['python']}
        plannerConfig={{ defaultWeeks: 4, defaultHours: 8, minWeeks: 1, maxWeeks: 16, minHours: 2, maxHours: 40 }}
        locale="en"
        defaultLocale="en"
        completed={new Set()}
        bookmarked={new Set()}
        notes={{}}
        toggleComplete={toggleComplete}
        toggleBookmark={vi.fn()}
        saveNote={vi.fn()}
        onOpenViewer={vi.fn()}
        onCreateSheet={vi.fn()}
        onDeleteSheet={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Group Anagrams')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(toggleComplete).toHaveBeenCalledWith('two-sum');
  });
});
