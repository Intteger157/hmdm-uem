import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import axios from 'axios'
import { Lock, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { Logo } from '@/components/Logo'
import { MOCK_AUTH } from '@/shared/api/mocks/auth'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { fetchCurrentUser, loginWithJwt } from '@/features/auth/api/auth-api'
import { fetchPublicSsoStatus } from '@/features/auth/api/sso-status-api'
import { fetchConsoleAccess } from '@/features/auth/api/console-profile-api'
import { MicrosoftIcon } from '@/features/auth/components/MicrosoftIcon'
import { useAuthStore } from '@/features/auth/store/auth-store'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { clearCookie, readCookie } from '@/shared/lib/cookies'

const REMEMBER_LOGIN_KEY = 'singularity-mdm-remember-login'
const SSO_JWT_COOKIE = 'singularity_sso_jwt'

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean(),
})

type LoginFormValues = z.infer<typeof loginSchema>

const inputClassName =
  'h-12 border-white/[0.08] bg-[#0a0a0a]/80 pl-11 pr-4 text-[0.9375rem] text-white shadow-inner shadow-black/20 placeholder:text-slate-600 transition-all duration-300 ease-out focus-visible:border-blue-500/50 focus-visible:bg-[#0c0c0c] focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.12),inset_0_1px_2px_rgba(0,0,0,0.4)] focus-visible:ring-0'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [isEntraEnabled, setIsEntraEnabled] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: '',
      password: '',
      rememberMe: false,
    },
  })

  useEffect(() => {
    const savedLogin = localStorage.getItem(REMEMBER_LOGIN_KEY)
    if (savedLogin) {
      form.setValue('login', savedLogin)
      form.setValue('rememberMe', true)
    }
  }, [form])

  useEffect(() => {
    let cancelled = false

    async function loadSsoStatus() {
      try {
        const status = await fetchPublicSsoStatus()
        if (!cancelled) {
          setIsEntraEnabled(status.entraEnabled)
        }
      } catch {
        if (!cancelled) {
          setIsEntraEnabled(false)
        }
      }
    }

    void loadSsoStatus()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')

    if (error) {
      window.history.replaceState({}, '', '/login')
      const messages: Record<string, string> = {
        user_not_found: t('login.ssoUserNotFound'),
        invalid_state: t('login.ssoInvalidState'),
        provider_error: t('login.ssoProviderError'),
        sso_not_configured: t('login.ssoNotConfigured'),
      }
      toast.error(messages[error] ?? t('login.ssoProviderError'))
      return
    }

    if (params.get('sso') !== 'success') {
      return
    }

    const jwt = readCookie(SSO_JWT_COOKIE)
    clearCookie(SSO_JWT_COOKIE)
    window.history.replaceState({}, '', '/login')

    if (!jwt) {
      toast.error(t('login.ssoProviderError'))
      return
    }

    const sessionJwt = jwt
    let cancelled = false

    async function completeSsoLogin() {
      try {
        useAuthStore.setState({ jwt: sessionJwt })
        const [user, access] = await Promise.all([fetchCurrentUser(), fetchConsoleAccess()])
        if (cancelled) {
          return
        }
        setAuth(sessionJwt, user, access)
        void navigate({ to: '/dashboard' })
      } catch {
        if (!cancelled) {
          useAuthStore.getState().logout()
          toast.error(t('login.ssoProviderError'))
        }
      }
    }

    void completeSsoLogin()

    return () => {
      cancelled = true
    }
  }, [navigate, setAuth, t])

  const handleMicrosoftSignIn = () => {
    window.location.href = '/api/auth/login/microsoft'
  }

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const jwt = await loginWithJwt(values.login, values.password)
      useAuthStore.setState({ jwt })
      const [user, access] = await Promise.all([fetchCurrentUser(), fetchConsoleAccess()])
      setAuth(jwt, user, access)

      if (values.rememberMe) {
        localStorage.setItem(REMEMBER_LOGIN_KEY, values.login.trim())
      } else {
        localStorage.removeItem(REMEMBER_LOGIN_KEY)
      }

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

  const handleForgotPassword = () => {
    toast.message(t('login.forgotPassword'), {
      description: t('login.forgotPasswordHint'),
    })
  }

  return (
    <div className="login-card-enter w-full max-w-[420px]">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101010]/75 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_32px_80px_rgba(0,0,0,0.55),0_0_80px_rgba(59,130,246,0.04)] backdrop-blur-xl sm:p-9">
        <div
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden
        />

        <div className="relative mb-8 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div
              className="absolute inset-0 scale-150 rounded-full bg-blue-500/15 blur-2xl"
              aria-hidden
            />
            <Logo
              size="lg"
              className="relative drop-shadow-[0_0_28px_rgba(124,58,237,0.45)]"
            />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-white">
            {t('login.brandTitle')}
          </h2>
          <p className="mt-1.5 text-sm text-slate-400">{t('login.brandSubtitle')}</p>
        </div>

        <div className="mb-7 space-y-1.5 border-b border-white/[0.06] pb-7">
          <h3 className="text-lg font-medium tracking-tight text-white">{t('login.title')}</h3>
          <p className="text-sm leading-relaxed text-slate-500">
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
                  <FormLabel className="text-[0.8125rem] font-medium text-slate-300">
                    {t('login.username')}
                  </FormLabel>
                  <FormControl>
                    <div className="group relative">
                      <User
                        className="pointer-events-none absolute top-1/2 left-3.5 size-[1.05rem] -translate-y-1/2 text-slate-600 transition-colors duration-300 ease-out group-focus-within:text-blue-400/90"
                        strokeWidth={1.75}
                      />
                      <Input
                        autoComplete="username"
                        className={inputClassName}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-400/90" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[0.8125rem] font-medium text-slate-300">
                    {t('login.password')}
                  </FormLabel>
                  <FormControl>
                    <div className="group relative">
                      <Lock
                        className="pointer-events-none absolute top-1/2 left-3.5 size-[1.05rem] -translate-y-1/2 text-slate-600 transition-colors duration-300 ease-out group-focus-within:text-blue-400/90"
                        strokeWidth={1.75}
                      />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className={cn(inputClassName, 'pr-11')}
                        {...field}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[0.6875rem] font-medium tracking-wide text-slate-600 uppercase transition-colors duration-200 hover:text-slate-400"
                      >
                        {showPassword ? t('login.hidePassword') : t('login.showPassword')}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-400/90" />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between gap-4 pt-0.5">
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2.5 space-y-0">
                    <FormControl>
                      <input
                        id="login-remember-me"
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                        className="size-4 rounded border-white/15 bg-[#0a0a0a] text-blue-500 accent-blue-500 transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/30"
                      />
                    </FormControl>
                    <FormLabel
                      htmlFor="login-remember-me"
                      className="cursor-pointer text-sm font-normal text-slate-400"
                    >
                      {t('login.rememberMe')}
                    </FormLabel>
                  </FormItem>
                )}
              />

              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-slate-500 transition-colors duration-200 hover:text-slate-300"
              >
                {t('login.forgotPassword')}
              </button>
            </div>

            {form.formState.errors.root && (
              <p
                className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3.5 py-2.5 text-sm text-red-300/95"
                role="alert"
              >
                {form.formState.errors.root.message}
              </p>
            )}

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="login-submit-btn group relative mt-1 h-12 w-full overflow-hidden rounded-xl text-[0.9375rem] font-medium text-white transition-all duration-300 ease-out disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="relative z-10">
                {form.formState.isSubmitting ? t('login.loading') : t('login.submit')}
              </span>
            </button>

            {isEntraEnabled && (
              <div className="space-y-4 pt-1">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.08]" />
                  <span className="text-sm text-slate-500">{t('login.orContinueWith')}</span>
                  <div className="h-px flex-1 bg-white/[0.08]" />
                </div>

                <button
                  type="button"
                  onClick={handleMicrosoftSignIn}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#111] text-[0.9375rem] font-medium text-white transition-all duration-300 ease-out hover:border-white/15 hover:bg-[#1a1a1a] active:scale-[0.992]"
                >
                  <MicrosoftIcon className="size-5 shrink-0" />
                  {t('login.signInWithMicrosoft')}
                </button>
              </div>
            )}
          </form>
        </Form>
      </div>

      <p className="login-fade-in mt-6 text-center text-xs text-slate-600">
        {t('login.securityNotice')}
      </p>
    </div>
  )
}
