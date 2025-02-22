/**
 * @license
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { assert } from 'chai';
import { stub } from 'sinon';
import { ErrorFactory, ErrorMap, FirebaseError } from '../src/errors';

type ErrorCode =
  | 'generic-error'
  | 'file-not-found'
  | 'anon-replace'
  | 'overwrite-field';

const ERROR_MAP: ErrorMap<ErrorCode> = {
  'generic-error': 'Unknown error',
  'file-not-found': "Could not find file: '{$file}'",
  'anon-replace': 'Hello, {$repl_}!',
  'overwrite-field':
    'I decided to use {$code} to represent the error code from my server.'
};

interface ErrorParams {
  'file-not-found': { file: string };
  'anon-replace': { repl_: string };
  'overwrite-field': { code: string };
}

const ERROR_FACTORY = new ErrorFactory<ErrorCode, ErrorParams>(
  'fake',
  'Fake',
  ERROR_MAP
);

describe('FirebaseError', () => {
  it('creates an Error', () => {
    const e = ERROR_FACTORY.create('generic-error');
    assert.instanceOf(e, Error);
    assert.instanceOf(e, FirebaseError);
    assert.equal(e.code, 'fake/generic-error');
    assert.equal(e.message, 'Fake: Unknown error (fake/generic-error).');
  });

  it('replaces template values with data', () => {
    const e = ERROR_FACTORY.create('file-not-found', { file: 'foo.txt' });
    assert.equal(e.code, 'fake/file-not-found');
    assert.equal(
      e.message,
      "Fake: Could not find file: 'foo.txt' (fake/file-not-found)."
    );
    assert.equal(e.file, 'foo.txt');
  });

  it('anonymously replaces template values with data', () => {
    const e = ERROR_FACTORY.create('anon-replace', { repl_: 'world' });
    assert.equal(e.code, 'fake/anon-replace');
    assert.equal(e.message, 'Fake: Hello, world! (fake/anon-replace).');
    assert.isUndefined(e.repl_);
  });

  it('uses "Error" as template when template is missing', () => {
    // Cast to avoid compile-time error.
    const e = ERROR_FACTORY.create(('no-such-code' as any) as ErrorCode);
    assert.equal(e.code, 'fake/no-such-code');
    assert.equal(e.message, 'Fake: Error (fake/no-such-code).');
  });

  it('uses the key in the template if the replacement is missing', () => {
    const e = ERROR_FACTORY.create('file-not-found', {
      fileX: 'foo.txt'
    } as any);
    assert.equal(e.code, 'fake/file-not-found');
    assert.equal(
      e.message,
      "Fake: Could not find file: '<file?>' (fake/file-not-found)."
    );
  });

  it('warns if overwriting a base error field with custom data', () => {
    const warnStub = stub(console, 'warn');
    const e = ERROR_FACTORY.create('overwrite-field', {
      code: 'overwritten code'
    });
    assert.equal(e.code, 'overwritten code');
    // TODO: use sinon-chai for this.
    assert.ok(
      warnStub.calledOnceWith(
        'Overwriting FirebaseError base field "code" can cause unexpected behavior.'
      )
    );
    warnStub.restore();
  });

  it('has stack', () => {
    const e = ERROR_FACTORY.create('generic-error');
    assert.isDefined(e.stack);
    // Multi-line match trick - .* does not match \n
    assert.match(e.stack!, /FirebaseError[\s\S]/);
  });

  it('has function names in stack trace in correct order', () => {
    try {
      dummy1();
      assert.ok(false);
    } catch (e) {
      assert.instanceOf(e, FirebaseError);
      assert.match(e.stack, /dummy2[\s\S]*?dummy1/);
    }
  });
});

function dummy1() {
  dummy2();
}

function dummy2() {
  throw ERROR_FACTORY.create('generic-error');
}
