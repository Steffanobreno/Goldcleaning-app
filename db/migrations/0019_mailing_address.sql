-- The address US law asks for in marketing emails (shown at the bottom of every email).
update businesses set mailing_address = '1201 Monte Diablo Ave, San Mateo, CA 94401'
where mailing_address is null or mailing_address = '';
