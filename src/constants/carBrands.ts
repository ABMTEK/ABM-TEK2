export const CAR_BRANDS = [
    { name: 'Toyota', domain: 'toyota.com' },
    { name: 'Honda', domain: 'honda.com' },
    { name: 'Mercedes-Benz', domain: 'mercedes-benz.com' },
    { name: 'BMW', domain: 'bmw.com' },
    { name: 'Lexus', domain: 'lexus.com' },
    { name: 'Ford', domain: 'ford.com' },
    { name: 'Volkswagen', domain: 'vw.com' },
    { name: 'Nissan', domain: 'nissan-global.com' },
    { name: 'Hyundai', domain: 'hyundai.com' },
    { name: 'Kia', domain: 'kia.com' },
    { name: 'Audi', domain: 'audi.com' },
    { name: 'Peugeot', domain: 'peugeot.com' },
    { name: 'Land Rover', domain: 'landrover.com' },
    { name: 'Mazda', domain: 'mazda.com' },
    { name: 'Chevrolet', domain: 'chevrolet.com' },
    { name: 'Jeep', domain: 'jeep.com' },
    { name: 'Subaru', domain: 'subaru.com' },
    { name: 'Mitsubishi', domain: 'mitsubishi-motors.com' },
    { name: 'Volvo', domain: 'volvocars.com' },
    { name: 'Porsche', domain: 'porsche.com' },
].sort((a, b) => a.name.localeCompare(b.name));

export const getCarBrandDomain = (make: string) => {
    if (!make) return null;
    const brand = CAR_BRANDS.find(b => b.name.toLowerCase() === make.toLowerCase());
    return brand ? brand.domain : null;
};
