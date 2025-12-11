import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL || 'http://server:8000';

async function proxyRequest(
  request: NextRequest,
  endpoint: string,
  method: string = 'GET'
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    // Detectar si es FormData (multipart/form-data)
    const contentType = request.headers.get('content-type');
    const isFormData = contentType?.includes('multipart/form-data');

    const headers: HeadersInit = {};

    // Solo agregar Content-Type si NO es FormData
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    // Agregar body si no es GET o HEAD
    if (method !== 'GET' && method !== 'HEAD') {
      if (isFormData) {
        // Para FormData, enviar el FormData directamente
        options.body = await request.formData();
      } else {
        // Para JSON, enviar como texto
        const body = await request.text();
        if (body) {
          options.body = body;
        }
      }
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const endpoint = `/${params.path.join('/')}`;
  const searchParams = request.nextUrl.searchParams.toString();
  const fullEndpoint = searchParams ? `${endpoint}?${searchParams}` : endpoint;
  return proxyRequest(request, fullEndpoint, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const endpoint = `/${params.path.join('/')}`;
  return proxyRequest(request, endpoint, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const endpoint = `/${params.path.join('/')}`;
  return proxyRequest(request, endpoint, 'PUT');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const endpoint = `/${params.path.join('/')}`;
  return proxyRequest(request, endpoint, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const endpoint = `/${params.path.join('/')}`;
  return proxyRequest(request, endpoint, 'DELETE');
}
