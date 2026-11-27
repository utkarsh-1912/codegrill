import React from 'react';
import {
  CIcon,
  CppIcon,
  CsharpIcon,
  DartIcon,
  FileCodeIcon,
  GoIcon,
  JavaIcon,
  JavascriptIcon,
  KotlinIcon,
  PythonIcon,
  RubyIcon,
  RustIcon,
  ScalaIcon,
  SwiftIcon,
  TypescriptIcon,
} from '@utkristi/ui';

const LANG_ICONS = {
  python: PythonIcon,
  py: PythonIcon,
  java: JavaIcon,
  cpp: CppIcon,
  'c++': CppIcon,
  cc: CppIcon,
  cxx: CppIcon,
  javascript: JavascriptIcon,
  js: JavascriptIcon,
  jsx: JavascriptIcon,
  mjs: JavascriptIcon,
  typescript: TypescriptIcon,
  ts: TypescriptIcon,
  tsx: TypescriptIcon,
  c: CIcon,
  csharp: CsharpIcon,
  cs: CsharpIcon,
  'c#': CsharpIcon,
  go: GoIcon,
  golang: GoIcon,
  ruby: RubyIcon,
  rb: RubyIcon,
  swift: SwiftIcon,
  kotlin: KotlinIcon,
  kt: KotlinIcon,
  rust: RustIcon,
  rs: RustIcon,
  scala: ScalaIcon,
  dart: DartIcon,
};

export function LanguageIcon({ lang, size = 15, className = '' }) {
  const key = String(lang || '').trim().toLowerCase();
  const Icon = LANG_ICONS[key] || FileCodeIcon;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
