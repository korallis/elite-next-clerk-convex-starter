import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="w-full max-w-md">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" afterSignInUrl="/onboarding" />
    </div>
  );
}
