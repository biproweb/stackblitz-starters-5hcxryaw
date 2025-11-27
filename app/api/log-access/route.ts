import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown'

  const body = await req.json()

  const { user_id, dashboard_name } = body

  await supabase.from('access_logs').insert({
    user_id,
    dashboard_name,
    accessed_at: new Date(),
    ip_address: ip,
  })

  return NextResponse.json({ success: true })
}
