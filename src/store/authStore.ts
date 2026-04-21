import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  role: string | null             // fetched from profiles
  fullName: string | null         // fetched from profiles
  mustChangePassword: boolean | null  // null = profile not yet loaded
  loading: boolean
  setSession: (session: Session | null) => Promise<void>
  setMustChangePassword: (val: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  fullName: null,
  mustChangePassword: null,
  loading: true,

  setSession: async (session) => {
    if (!session) {
      set({ session: null, user: null, role: null, fullName: null, mustChangePassword: null, loading: false })
      return
    }

    // Unblock UI immediately — role + mustChangePassword load in background
    set({ session, user: session.user, role: null, fullName: null, mustChangePassword: null, loading: false })

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, full_name, must_change_password')
        .eq('id', session.user.id)
        .maybeSingle()

      console.log('Full profile data:', JSON.stringify(profile))

      if (error) {
        console.error('[authStore] Profile fetch error:', error.message)
        set({ mustChangePassword: false }) // fail-open — don't leave as null
        return
      }
      console.log('User role:', profile?.role)
      console.log(`[authStore] Profile fetched — role="${profile?.role}" mustChangePassword=${profile?.must_change_password}`)
      const fetchedRole = profile?.role ? profile.role.toLowerCase() : 'office_staff'
      console.log(`[authStore] Profile fetched — raw role="${profile?.role}" normalised="${fetchedRole}"`)
      set({
        role: fetchedRole,
        fullName: profile?.full_name ?? null,
        mustChangePassword: profile?.must_change_password ?? false,
      })
    } catch (err) {
      console.error('[authStore] Unexpected profile fetch failure:', err)
      set({ mustChangePassword: false }) // fail-open so the app doesn't get stuck
    }
  },

  setMustChangePassword: (val) => set({ mustChangePassword: val }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, role: null, fullName: null, mustChangePassword: null })
  },
}))
