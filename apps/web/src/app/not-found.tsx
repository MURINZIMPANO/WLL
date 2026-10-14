import { Button } from '@lyriclens/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-5 text-center">
      <p className="text-sm font-bold tracking-wide text-accent-text uppercase">404</p>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-balance">
        There is nothing playing here.
      </h1>
      <p className="mt-3 text-base text-text-mid">
        That page does not exist. If you followed a link from LyricLens, it may belong to a phase
        that has not shipped yet.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Back to the start</Link>
      </Button>
    </div>
  );
}
