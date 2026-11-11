import React from 'react';

export const StudioLighting: React.FC = () => {
  return (
    <group name="studio-lighting">
      {/* Key light */}
      <directionalLight position={[6, 10, 6]} intensity={1.2} color="#ffffff" />
      {/* Fill light */}
      <directionalLight position={[-6, 4, -4]} intensity={0.5} color="#d0d6e0" />
      {/* Rim light */}
      <directionalLight position={[0, 6, -8]} intensity={0.4} color="#e2e8f0" />
      {/* Ambient base */}
      <ambientLight intensity={0.4} color="#ffffff" />
    </group>
  );
};
