'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { RefreshCw, User, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Pegawai = {
  id: string;
  full_name: string;
  position: string;
  role: string;
};

export default function DataPegawaiPage() {
  const router = useRouter();
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [filteredList, setFilteredList] = useState<Pegawai[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchPegawai = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, position, role')
          .eq('role', 'pegawai');

        if (error) console.error('Error fetching pegawai:', error);
        else {
          setPegawaiList(data || []);
          setFilteredList(data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPegawai();
  }, []);

  useEffect(() => {
    if (!search) setFilteredList(pegawaiList);
    else {
      const lowerSearch = search.toLowerCase();
      setFilteredList(
        pegawaiList.filter(
          (p) =>
            p.full_name.toLowerCase().includes(lowerSearch) ||
            p.position.toLowerCase().includes(lowerSearch)
        )
      );
    }
  }, [search, pegawaiList]);

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <RefreshCw className="h-8 w-8 animate-spin text-green-500" />
          <p className="mt-4 text-gray-600 font-semibold">Memuat Data Pegawai...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-5">
      {/* Tombol kembali */}
      <button
        onClick={() => router.push('/dashboardadmin')} // Ganti dengan path dashboard
        className="mb-4 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition"
      >
        <ArrowLeft size={20} /> Kembali ke Dashboard
      </button>

      <h1 className="text-2xl font-bold text-gray-800 mb-4">Data Pegawai</h1>

      <input
        type="text"
        placeholder="Cari nama atau jabatan..."
        className="mb-6 w-full md:w-1/2 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 shadow-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredList.length === 0 ? (
        <p className="text-gray-600">Belum ada pegawai terdaftar atau tidak ditemukan.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredList.map((pegawai, index) => (
            <div
              key={pegawai.id}
              className={`p-5 rounded-xl shadow-lg border-l-4 transition duration-300 hover:scale-105 cursor-pointer ${
                index % 2 === 0 ? 'bg-green-50 border-green-400' : 'bg-green-100 border-green-500'
              }`}
            >
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 rounded-full bg-green-200 text-green-800">
                  <User size={28} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-gray-800">{pegawai.full_name}</h2>
                  <p className="text-sm text-gray-600">{pegawai.position}</p>
                </div>
              </div>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Role:</span> {pegawai.role}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
