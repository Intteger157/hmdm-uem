import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { MOCK_AUTH } from '@/shared/api/mocks/auth'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { fetchCurrentUser, loginWithJwt } from '@/features/auth/api/auth-api'
import { fetchConsoleAccess } from '@/features/auth/api/console-profile-api'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: '',
      password: '',
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const jwt = await loginWithJwt(values.login, values.password)
      useAuthStore.setState({ jwt })
      const [user, access] = await Promise.all([fetchCurrentUser(), fetchConsoleAccess()])
      setAuth(jwt, user, access)
      void navigate({ to: '/dashboard' })
    } catch (err) {
      const isUnauthorized =
        (err instanceof Error && 'status' in err && err.status === 401) ||
        (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 400))
      if (isUnauthorized) {
        form.setError('root', { message: t('login.error') })
      } else {
        form.setError('root', { message: t('login.error') })
      }
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8 space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white">{t('login.title')}</h2>
        <p className="text-sm text-slate-400">
          {isMockApiEnabled()
            ? t('login.mockHint', { login: MOCK_AUTH.login, password: MOCK_AUTH.password })
            : t('login.subtitle')}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="login"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200">{t('login.username')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="username"
                    className="h-11 border-slate-700 bg-slate-900/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus-visible:border-[#1c40e3] focus-visible:ring-[#1c40e3]/30"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-400" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200">{t('login.password')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    className="h-11 border-slate-700 bg-slate-900/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus-visible:border-[#1c40e3] focus-visible:ring-[#1c40e3]/30"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-400" />
              </FormItem>
            )}
          />
          {form.formState.errors.root && (
            <p
              className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"
              role="alert"
            >
              {form.formState.errors.root.message}
            </p>
          )}
          <Button
            type="submit"
            className="h-11 w-full border-0 bg-[#1c40e3] text-base text-white hover:bg-[#3355f0]"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? t('login.loading') : t('login.submit')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
