#!/bin/bash

if [ -d "anymatix/miniforge" ]; then
  echo "Starting aggressive cleanup to reduce size..."
  
  # Remove unnecessary directories
  find anymatix/miniforge -type d -name "__pycache__" -exec rm -rf {} \; 2>/dev/null || true
  find anymatix/miniforge -type d -name "tests" -exec rm -rf {} \; 2>/dev/null || true
  find anymatix/miniforge -type d -name "test" -exec rm -rf {} \; 2>/dev/null || true
  
  # Remove package info and documentation
  find anymatix/miniforge -type d -name "*.dist-info" -exec rm -rf {} \; 2>/dev/null || true
  find anymatix/miniforge -type d -name "*.egg-info" -exec rm -rf {} \; 2>/dev/null || true
  find anymatix/miniforge -type d -name "man" -exec rm -rf {} \; 2>/dev/null || true
  find anymatix/miniforge -type d -name "doc" -exec rm -rf {} \; 2>/dev/null || true
  find anymatix/miniforge -type d -name "docs" -exec rm -rf {} \; 2>/dev/null || true
  find anymatix/miniforge -type d -name "examples" -exec rm -rf {} \; 2>/dev/null || true
  
  # Remove conda package cache and unnecessary files
  rm -rf anymatix/miniforge/pkgs/* 2>/dev/null || true
  rm -rf anymatix/miniforge/conda-meta/*.json 2>/dev/null || true
  rm -rf anymatix/miniforge/envs 2>/dev/null || true
  
  # Remove unnecessary file types
  find anymatix/miniforge -name "*.a" -delete 2>/dev/null || true
  find anymatix/miniforge -name "*.js.map" -delete 2>/dev/null || true
  find anymatix/miniforge -name "*.h" -delete 2>/dev/null || true
  find anymatix/miniforge -name "*.hpp" -delete 2>/dev/null || true
  find anymatix/miniforge -name "*.c" -delete 2>/dev/null || true
  find anymatix/miniforge -name "*.cpp" -delete 2>/dev/null || true
  
  # Remove unused Python standard library modules
  for dir in anymatix/miniforge/lib/python*/; do
    if [ -d "$dir" ]; then
      for module in idlelib turtledemo tkinter ensurepip distutils lib2to3 unittest; do
        rm -rf "$dir/$module" 2>/dev/null || true
      done
    fi
  done
  
  # Remove .git directories from cloned repositories
  find anymatix -type d -name ".git" -exec rm -rf {} \; 2>/dev/null || true
  
  # Report size after cleanup
  echo "Size after cleanup:"
  du -sh anymatix
else
  echo "Warning: anymatix/miniforge directory not found. Looking for other directories:"
  find anymatix -type d -maxdepth 1
fi 