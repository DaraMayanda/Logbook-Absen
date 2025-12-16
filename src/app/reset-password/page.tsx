import dynamic from 'next/dynamic'

// Disable SSR karena ResetPasswordPage pakai useSearchParams() dan client hooks
const ResetPasswordPage = dynamic(() => import('./ResetPasswordPage'), { ssr: false })

export default function Page() {
  return <ResetPasswordPage />
}
