#!/bin/sh

if [ -d test/fixed ]; then
  rm -rf test/fixed
fi

mkdir test/fixed
cp test/*.swift test/fixed
