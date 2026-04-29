/**
 * @file primitives/__tests__/primitives.test.tsx
 * @description
 * Smoke tests for the shadcn-style primitives. Storybook + axe handle
 * the visual + accessibility layer; these tests pin the API contracts
 * (variant class names, polymorphic `asChild`, controlled `Switch`)
 * against future regressions.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button.js';
import { Switch } from '../Switch.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
} from '../Card.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../Tabs.js';

describe('Button', () => {
  it('renders a native <button> with primary variant + md size by default', () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn.className).toMatch(/alphabet-btn/);
    expect(btn.className).toMatch(/alphabet-btn--primary/);
    expect(btn.className).toMatch(/alphabet-btn--size-md/);
  });

  it('applies the requested variant + size classes', () => {
    render(
      <Button variant="glass" size="lg">
        Glass
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Glass' });
    expect(btn.className).toMatch(/alphabet-btn--glass/);
    expect(btn.className).toMatch(/alphabet-btn--size-lg/);
  });

  it('renders an arbitrary child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/docs">Docs</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/docs');
    expect(link.className).toMatch(/alphabet-btn/);
    expect(link).not.toHaveAttribute('type');
  });

  it('forwards extra className without dropping component classes', () => {
    render(<Button className="extra">Mix</Button>);
    const btn = screen.getByRole('button', { name: 'Mix' });
    expect(btn.className).toMatch(/alphabet-btn/);
    expect(btn.className).toMatch(/extra/);
  });
});

describe('Card', () => {
  it('renders all slots with semantic structure', () => {
    render(
      <Card variant="glass" data-testid="card">
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardBody>Body</CardBody>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByTestId('card').className).toMatch(/alphabet-card--glass/);
    expect(screen.getByRole('heading', { name: 'Title', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});

describe('Switch', () => {
  it('exposes role=switch and toggles on click', () => {
    render(<Switch aria-label="Reduced motion" />);
    const sw = screen.getByRole('switch', { name: 'Reduced motion' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Tabs', () => {
  it('renders a tablist with the default tab selected', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList aria-label="Sections">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">First</TabsContent>
        <TabsContent value="b">Second</TabsContent>
      </Tabs>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('First')).toBeInTheDocument();
  });
});
