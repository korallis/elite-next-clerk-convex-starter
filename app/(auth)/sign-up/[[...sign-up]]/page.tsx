import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="w-full max-w-md">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" afterSignUpUrl="/onboarding" />
    </div>
  );
}
