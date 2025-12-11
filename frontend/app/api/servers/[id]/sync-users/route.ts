import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return NextResponse.json({ detail: 'No autenticado' }, { status: 401 });
  }

  const apiUrl = process.env.API_URL || 'http://api:8000';
  const serverId = params.id;

  try {
    const response = await fetch(`${apiUrl}/servers/${serverId}/sync-users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error syncing users:', error);
    return NextResponse.json(
      { detail: 'Error al conectar con el servidor' },
      { status: 500 }
    );
  }
}
